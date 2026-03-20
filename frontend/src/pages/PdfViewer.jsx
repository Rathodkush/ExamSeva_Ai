import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import * as pdfjsLib from 'pdfjs-dist';
import 'pdfjs-dist/build/pdf.worker.entry';
import '../styles/PdfViewer.css';

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

export default function PdfViewer() {
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const query = useQuery();

  useEffect(() => {
    const file = query.get('file');
    const pageNo = parseInt(query.get('page') || '1', 10);
    const rectsParam = query.get('rects');

    let rects = [];
    try {
      rects = rectsParam ? JSON.parse(decodeURIComponent(rectsParam)) : [];
    } catch (e) {
      rects = [];
    }

    if (!file) {
      alert('Missing file parameter');
      return;
    }

    // Optional: show a small banner indicating the matching question
    const questionText = query.get('question');
    const snippet = query.get('snippet');
    if (questionText) {
      setTimeout(() => {
        // show a small notice to the user (non-blocking)
        const banner = document.createElement('div');
        banner.className = 'pdf-answer-banner';
        banner.innerHTML = `<strong>Answer match:</strong> ${questionText.substring(0, 200)} ${snippet ? '<div style="opacity:0.85;margin-top:6px;font-size:13px;color:#333">Snippet: '+ snippet.substring(0,200) + '</div>' : ''}`;
        banner.style.position = 'fixed';
        banner.style.top = '80px';
        banner.style.left = '50%';
        banner.style.transform = 'translateX(-50%)';
        banner.style.background = '#fffbe6';
        banner.style.border = '1px solid #ffe58f';
        banner.style.padding = '10px 16px';
        banner.style.borderRadius = '6px';
        banner.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
        banner.style.zIndex = 9999;
        document.body.appendChild(banner);
        setTimeout(() => banner.remove(), 7000);
      }, 600);
    }

    const load = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        const resp = await axios.get(`${process.env.REACT_APP_API_URL || "http://localhost:4000"}/api/studyhub/open?path=${encodeURIComponent(file)}`, {
          responseType: 'arraybuffer',
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });

        const pdfData = new Uint8Array(resp.data);
        const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
        const page = await pdf.getPage(pageNo);
        const viewport = page.getViewport({ scale: 1.5 });

        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);

        const renderContext = {
          canvasContext: context,
          viewport: viewport
        };

        await page.render(renderContext).promise;

        // Draw rect overlays
        const overlay = overlayRef.current;
        overlay.style.width = canvas.width + 'px';
        overlay.style.height = canvas.height + 'px';
        overlay.innerHTML = '';

        rects.forEach(r => {
          try {
            // rects from Python are PDF points: [x0,y0,x1,y1] in PDF coordinate (origin bottom-left)
            const pdfRect = [r.x0, r.y0, r.x1, r.y1];
            const viewportRect = viewport.convertToViewportRectangle(pdfRect);
            // viewport.convertToViewportRectangle returns [x1, y1, x2, y2]
            const x = Math.min(viewportRect[0], viewportRect[2]);
            const y = Math.min(viewportRect[1], viewportRect[3]);
            const w = Math.abs(viewportRect[2] - viewportRect[0]);
            const h = Math.abs(viewportRect[3] - viewportRect[1]);

            const el = document.createElement('div');
            el.className = 'pdf-highlight';
            el.style.left = `${x}px`;
            el.style.top = `${y}px`;
            el.style.width = `${w}px`;
            el.style.height = `${h}px`;
            overlay.appendChild(el);
          } catch (err) {
            console.warn('Failed to draw rect', err);
          }
        });

      } catch (err) {
        console.error('Failed to load PDF', err);
        alert('Failed to load PDF viewer');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [query]);

  return (
    <div className="pdf-viewer-container">
      {loading && <div className="pdf-loading">Loading PDF…</div>}
      <div className="pdf-canvas-wrap">
        <canvas ref={canvasRef} className="pdf-canvas" />
        <div ref={overlayRef} className="pdf-overlay" />
      </div>
    </div>
  );
}
