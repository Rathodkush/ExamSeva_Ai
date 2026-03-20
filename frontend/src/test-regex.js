const formatQuestion = (text) => {
  if (!text) return { text: '', answer: null };
  // Clean up the question text
  let formatted = text.trim();

  // Extract answer if embedded
  let answer = null;
  const answerMatch = formatted.match(/\[Answer:\s*(.+?)\]/);
  if (answerMatch) {
    answer = answerMatch[1].trim();
    formatted = formatted.replace(/\[Answer:\s*.+?\]/, '').trim();
  }

  // AGGRESSIVE: Remove common exam boilerplate phrases
  const boilerplate = [
    /all\s+questions?\s+are\s+compulsory/gi,
    /figures?\s+to\s+the\s+right\s+indicate\s+full\s+marks/gi,
    /use\s+of\s+stencil\s+is\s+allowed/gi,
    /answers?\s+should\s+be\s+written\s+in\s+black\s+or\s+blue/gi,
    /note:—\s*\(1\)\s*all\s+questions\/activities\s+are\s+compulsory/gi,
    /for\s+q\.\s+no\.\s+\d+\(a\)\s+use\s+supplied\s+outline\s+map/gi,
    /use\s+the\s+graph\s+paper/gi,
    /draw\s+neat\s+diagrams/gi,
    /p\.t\.o\./gi,
    /oswa\s+publishers/gi,
    /seat\s+no\./gi,
    /revised\s+course/gi,
    /socialsciences/gi,
    /geography/gi,
    /mark\s+the\s+following\s+in\s+the\s+outline\s+map/gi,
    /observe\s+the\s+given\s+map/gi,
    /match\s+the\s+following/gi,
    /write\s+short\s+notes\s+on/gi,
    /iv\s+04\s+1030/gi,
    /\(\s*\d+\s*marks?\s*\)/gi  // Remove marks in brackets like (15 marks)
  ];
  boilerplate.forEach(regex => {
    formatted = formatted.replace(regex, '');
  });

  // SIDA (DIRECT) FILTER: Block instructional headers that often become fake repeated questions
  const instructionalHeader = /^\s*(|answer|choose|select|solve|anly|auy|anv|anly|anv|an)\s+(any|all|anv|auy|one|two|three|four|five|six|eight|ten)\b/gi;
  if (instructionalHeader.test(formatted)) {
    return { text: '', answer: null, isNoise: true, reason: 'instructionalHeader' };
  }

  // Remove leading numbering or option labels like "1.", "1)", "(a)", "A.", "A)"
  formatted = formatted.replace(/^\s*(\(?\d{1,3}[\).\-\:]\s*|\(?[a-hA-H][\).\-\:]\s*)/, '');

  // NOISE FILTER: If the string is mostly single letters and symbols, it's likely OCR noise
  const tokens = formatted.split(/\s+/);
  const shortTokens = tokens.filter(t => t.length <= 2).length;
  if (tokens.length > 5 && (shortTokens / tokens.length) > 0.6) {
    return { text: '', answer: null, isNoise: true, reason: 'shortTokens' };
  }

  // Fix common OCR errors: add spaces before capital letters in the middle of words
  formatted = formatted.replace(/([a-z])([A-Z])/g, '$1 $2');
  formatted = formatted.replace(/\s+/g, ' ').trim();

  return { text: formatted, answer };
};

const rep = "Software Quality Assurance";
const fs = require('fs');
fs.writeFileSync('output.json', JSON.stringify([
  formatQuestion(rep),
  formatQuestion("Attempt any two"),
  formatQuestion("Explain the concept of SQC"),
  formatQuestion("What is Software Quality Assurance?")
], null, 2));
