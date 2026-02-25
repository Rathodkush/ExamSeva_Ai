 <!-- Backend Server Setup -->

<!-- Quick Start -->

<!-- 1.Install Dependencies** -->
   ```bash
   cd backend
   npm install
   ```

<!-- 2. Start MongoDB (if not already running) -->
   ```bash
   # On Windows (if MongoDB is installed as service, it may already be running)
   # Or download and install MongoDB from https://www.mongodb.com/try/download/community
   ```

<!-- 3. Start Backend Server -->
   ```bash
   node server.js
   ```

   You should see:
   ```
    MongoDB connected (or  MongoDB connection error if not running)
   Backend running on http://localhost:4000
   ```

<!-- ## API Endpoints -->

- `GET /api/health` - Health check
- `POST /api/notes` - Upload study notes
- `GET /api/notes` - Get all notes
- `GET /api/notes/:id/download` - Download a note
- `DELETE /api/notes/:id` - Delete a note
- `POST /api/quiz/generate` - Generate quiz from PDF
- `POST /api/quiz/generate_paper` - Generate printable question paper PDF from notes (accepts advanced options)
- `POST /api/exam/detect` - Lightweight class/mode detection from uploaded notes (returns `{ detected: { mode, classLevel } }`)
- `POST /api/forum/posts` - Create forum post
- `GET /api/forum/posts` - Get all posts
- `POST /api/forum/posts/:id/reply` - Reply to post
- `POST /api/forum/posts/:id/like` - Like/unlike post


## Quick Tests
- Run a manual test to detect and generate a paper using a sample notes file:

```bash
cd backend
npm run test:paper
```

This will call `/api/exam/detect` and then `/api/quiz/generate_paper` and save the result as `temp_question_paper.pdf` if successful.

<!-- Troubleshooting -->

<!-- 404 Errors -->
- Make sure the backend server is running on port 4000
- Check if you see "Backend running on http://localhost:4000" in the console

 <!-- MongoDB Errors -->
- The app will work even if MongoDB is not connected (with limited functionality)
- To use database features, ensure MongoDB is running on `mongodb://127.0.0.1:27017`

<!-- Port Already in Use -->
- Change PORT in server.js or use environment variable: `PORT=4001 node server.js`


