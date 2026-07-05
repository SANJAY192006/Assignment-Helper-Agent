import React, { useState, useEffect, useRef } from 'react';
import { marked } from 'marked';

export default function App() {
  // --- 1. State Configurations ---
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  
  const [subject, setSubject] = useState('');
  const [customSubject, setCustomSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [question, setQuestion] = useState('');
  const [validated, setValidated] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [loadingSubtext, setLoadingSubtext] = useState('');
  
  const [guideData, setGuideData] = useState(null);
  const [metaSubject, setMetaSubject] = useState('');
  const [metaTopic, setMetaTopic] = useState('');
  
  const [toast, setToast] = useState({ show: false, message: '', isError: false });
  
  const resultsRef = useRef(null);
  const toastTimeoutRef = useRef(null);

  // --- 2. Theme Side Effect ---
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // --- 3. Loader Quote Interval ---
  useEffect(() => {
    let interval;
    if (loading) {
      const quotes = [
        "Analyzing core concepts...",
        "Formulating structured learning objectives...",
        "Structuring a step-by-step logic breakdown...",
        "Drafting a simple real-world analogy...",
        "Designing assignment-ready solution template...",
        "Assembling sample codes & testing logic...",
        "Calculating algorithm and execution complexities...",
        "Drafting potential viva/interview questions...",
        "Compiling practice exercises for self-learning..."
      ];
      setLoadingSubtext(quotes[0]);
      let index = 0;
      interval = setInterval(() => {
        index = (index + 1) % quotes.length;
        setLoadingSubtext(quotes[index]);
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [loading]);

  // --- 4. Toast helper ---
  const showToast = (message, isError = false) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ show: true, message, isError });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 4000);
  };

  // --- 5. Form Handling ---
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setValidated(true);

    const actualSubject = subject === 'Other' ? customSubject.trim() : subject;
    if (!actualSubject || !topic.trim() || !question.trim()) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: actualSubject,
          topic: topic.trim(),
          question: question.trim()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        showToast(data.error || "An error occurred. Please try again.", true);
        setLoading(false);
        return;
      }

      setGuideData(data);
      setMetaSubject(actualSubject);
      setMetaTopic(topic.trim());
      setLoading(false);
      showToast("Learning Guide generated successfully!", false);

      // Smooth scroll to results
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);

    } catch (error) {
      console.error("API Error:", error);
      showToast("Unable to contact the AI service. Please try again.", true);
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSubject('');
    setCustomSubject('');
    setTopic('');
    setQuestion('');
    setValidated(false);
    setGuideData(null);
    setMetaSubject('');
    setMetaTopic('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast("Form reset cleared.", false);
  };

  // --- 6. Helper for Markdown Parsing ---
  const getParsedHtml = (markdownText) => {
    return { __html: marked.parse(markdownText || '') };
  };

  // --- 7. Clipboard Copy Actions ---
  const handleCopySection = (title, text) => {
    navigator.clipboard.writeText(text)
      .then(() => showToast(`${title} copied successfully!`, false))
      .catch(() => showToast("Failed to copy. Please try again.", true));
  };

  const handleCopyEntireGuide = () => {
    if (!guideData) return;

    let compiledText = `==================================================\n`;
    compiledText += `${metaTopic.toUpperCase()} - LEARNING GUIDE\n`;
    compiledText += `Subject: ${metaSubject}\n`;
    compiledText += `==================================================\n\n`;

    compiledText += `1. CONCEPT EXPLANATION\n------------------\n${guideData.concept_explanation}\n\n`;
    
    compiledText += `2. LEARNING OBJECTIVES\n------------------\n`;
    guideData.learning_objectives.forEach(obj => {
      compiledText += `- ${obj}\n`;
    });
    compiledText += `\n`;

    compiledText += `3. STEP-BY-STEP EXPLANATION\n------------------\n${guideData.step_by_step_explanation}\n\n`;
    compiledText += `4. SIMPLE EXAMPLE\n------------------\n${guideData.simple_example}\n\n`;
    compiledText += `5. ASSIGNMENT SOLUTION\n------------------\n${guideData.assignment_solution}\n\n`;

    const codeEx = guideData.code_example;
    if (codeEx && codeEx.language && codeEx.language !== 'N/A' && codeEx.code.trim() !== '') {
      compiledText += `6. CODE EXAMPLE (${codeEx.language})\n------------------\n`;
      compiledText += `Explanation:\n${codeEx.explanation}\n\nCode:\n${codeEx.code}\n\n`;
    }

    const comp = guideData.complexity_analysis;
    if (comp && comp.time_complexity && comp.time_complexity !== 'N/A') {
      compiledText += `7. COMPLEXITY ANALYSIS\n------------------\n`;
      compiledText += `Time Complexity: ${comp.time_complexity}\n`;
      compiledText += `Space Complexity: ${comp.space_complexity}\n`;
      compiledText += `Explanation:\n${comp.explanation}\n\n`;
    }

    compiledText += `8. IMPORTANT KEY POINTS\n------------------\n`;
    guideData.important_key_points.forEach((pt, i) => {
      compiledText += `${i + 1}. ${pt}\n`;
    });
    compiledText += `\n`;

    compiledText += `9. VIVA QUESTIONS\n------------------\n`;
    guideData.viva_questions.forEach((viva, i) => {
      compiledText += `Q${i + 1}: ${viva.question}\nAnswer: ${viva.answer}\n\n`;
    });

    compiledText += `10. PRACTICE QUESTIONS\n------------------\n`;
    guideData.practice_questions.forEach(q => {
      compiledText += `- ${q}\n`;
    });
    compiledText += `\n`;

    compiledText += `11. INTERVIEW PREP\n------------------\n`;
    guideData.interview_questions.forEach((qna, i) => {
      compiledText += `Q${i + 1}: ${qna.question}\nAnswer: ${qna.answer}\n\n`;
    });

    compiledText += `12. SHORT SUMMARY\n------------------\n${guideData.short_summary}\n`;

    navigator.clipboard.writeText(compiledText)
      .then(() => showToast("Entire guide copied to clipboard!", false))
      .catch(() => showToast("Failed to copy entire guide.", true));
  };

  // --- 8. PDF Download Action ---
  const handleDownloadPdf = () => {
    if (!guideData) return;

    setLoading(true);
    setLoadingSubtext("Formatting PDF layout and margins...");

    const opt = {
      margin:       [15, 15, 15, 15],
      filename:     `${metaTopic.replace(/\s+/g, '_')}_Learning_Guide.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, logging: false },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
    };

    const printElement = document.createElement('div');
    printElement.style.color = '#111827';
    printElement.style.backgroundColor = '#ffffff';
    printElement.style.padding = '10px';

    let pdfHtml = `
      <div style="text-align: center; border-bottom: 2px solid #4f46e5; padding-bottom: 15px; margin-bottom: 30px;">
        <h1 style="color: #4f46e5; margin: 0; font-family: sans-serif;">EduAssist AI</h1>
        <p style="color: #4b5563; margin: 5px 0 0 0; font-family: sans-serif; font-size: 14px;">
          Guided Learning Assistant &bull; Subject: ${metaSubject}
        </p>
      </div>
    `;

    // 1. Concept
    pdfHtml += createPdfCard("1. Concept Explanation", marked.parse(guideData.concept_explanation));
    
    // 2. Objectives
    let objList = '<ul>';
    guideData.learning_objectives.forEach(o => { objList += `<li>${o}</li>`; });
    objList += '</ul>';
    pdfHtml += createPdfCard("2. Learning Objectives", objList);

    // 3. Steps
    pdfHtml += createPdfCard("3. Step-by-Step Explanation", marked.parse(guideData.step_by_step_explanation));
    
    // 4. Simple Example
    pdfHtml += createPdfCard("4. Simple Example", marked.parse(guideData.simple_example));
    
    // 5. Solution
    pdfHtml += createPdfCard("5. Assignment Solution", marked.parse(guideData.assignment_solution));

    // 6. Code
    const codeEx = guideData.code_example;
    if (codeEx && codeEx.language && codeEx.language !== 'N/A' && codeEx.code.trim() !== '') {
      const codeHtml = `
        <div>${marked.parse(codeEx.explanation)}</div>
        <pre style="background-color: #f3f4f6; border: 1px solid #d1d5db; padding: 12px; border-radius: 6px; font-family: monospace; white-space: pre-wrap;"><code>${codeEx.code}</code></pre>
      `;
      pdfHtml += createPdfCard(`6. Code Example (${codeEx.language})`, codeHtml);
    }

    // 7. Complexity
    const comp = guideData.complexity_analysis;
    if (comp && comp.time_complexity && comp.time_complexity !== 'N/A') {
      const compHtml = `
        <p><strong>Time Complexity:</strong> <span style="color: #4f46e5;">${comp.time_complexity}</span></p>
        <p><strong>Space Complexity:</strong> <span style="color: #065f46;">${comp.space_complexity}</span></p>
        <div>${marked.parse(comp.explanation)}</div>
      `;
      pdfHtml += createPdfCard("7. Complexity Analysis", compHtml);
    }

    // 8. Keypoints
    let kpList = '<ol>';
    guideData.important_key_points.forEach(k => { kpList += `<li>${k}</li>`; });
    kpList += '</ol>';
    pdfHtml += createPdfCard("8. Important Key Points", kpList);

    // 9. Viva
    let vivaHtml = '';
    guideData.viva_questions.forEach((v, i) => {
      vivaHtml += `
        <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; margin-bottom: 10px; background-color: #f9fafb;">
          <p style="font-weight: bold; margin: 0 0 5px 0;">Q${i+1}: ${v.question}</p>
          <p style="margin: 0; color: #4b5563;">Answer: ${v.answer}</p>
        </div>
      `;
    });
    pdfHtml += createPdfCard("9. Viva Questions", vivaHtml);

    // 10. Practice
    let pracList = '<ul>';
    guideData.practice_questions.forEach(q => { pracList += `<li style="padding: 6px; background-color: #f9fafb; border: 1px dashed #d1d5db; border-radius: 6px; margin-bottom: 6px; list-style: none;">${q}</li>`; });
    pracList += '</ul>';
    pdfHtml += createPdfCard("10. Practice Questions", pracList);

    // 11. Interview
    let intHtml = '';
    guideData.interview_questions.forEach((qna, i) => {
      intHtml += `
        <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; margin-bottom: 10px; background-color: #f9fafb;">
          <p style="font-weight: bold; margin: 0 0 5px 0;">Q${i+1}: ${qna.question}</p>
          <p style="margin: 0; color: #4b5563;">Answer: ${qna.answer}</p>
        </div>
      `;
    });
    pdfHtml += createPdfCard("11. Interview Prep", intHtml);

    // 12. Summary
    pdfHtml += createPdfCard("12. Short Summary", marked.parse(guideData.short_summary));

    printElement.innerHTML = pdfHtml;

    const style = document.createElement('style');
    style.innerHTML = `
      ul, ol { padding-left: 20px; margin-bottom: 10px; font-family: sans-serif; }
      li { margin-bottom: 5px; font-size: 14px; color: #374151; }
      table { width: 100%; border-collapse: collapse; margin: 15px 0; font-family: sans-serif; }
      th, td { padding: 8px 12px; border: 1px solid #d1d5db; font-size: 14px; }
      th { background-color: #f3f4f6; }
      h2 { color: #4f46e5; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; margin-top: 0; font-size: 18px; }
      p { font-family: sans-serif; }
    `;
    printElement.appendChild(style);

    window.html2pdf().set(opt).from(printElement).save().then(() => {
      setLoading(false);
      showToast("PDF downloaded successfully!", false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
      showToast("Failed to generate PDF.", true);
    });
  };

  const createPdfCard = (title, bodyHtml) => {
    return `
      <div style="margin-bottom: 30px; page-break-inside: avoid; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; font-family: sans-serif;">
        <h2>${title}</h2>
        <div style="color: #374151; font-size: 14px; line-height: 1.6;">
          ${bodyHtml}
        </div>
      </div>
    `;
  };

  // --- 9. Toggle Theme Callback ---
  const handleThemeToggle = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // --- 10. Check if Code/Complexity fields are active ---
  const showCodeCard = guideData && guideData.code_example && 
                       guideData.code_example.language && 
                       guideData.code_example.language !== 'N/A' && 
                       guideData.code_example.code.trim() !== '';

  const showComplexityCard = guideData && guideData.complexity_analysis && 
                             guideData.complexity_analysis.time_complexity && 
                             guideData.complexity_analysis.time_complexity !== 'N/A';

  return (
    <>
      {/* Sticky Navigation Bar */}
      <nav className="navbar navbar-expand-lg sticky-top">
        <div className="container-fluid px-md-5">
          <a className="navbar-brand" href="/">
            <i className="bi bi-mortarboard-fill text-primary"></i>
            <span className="brand-text">EduAssist <span className="text-primary">AI</span></span>
          </a>
          <div className="d-flex align-items-center gap-3 ms-auto">
            <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-3 py-2 rounded-pill d-none d-md-inline-block">
              <i className="bi bi-cpu-fill me-1"></i> College TA Agent
            </span>
            <button 
              id="themeToggleBtn" 
              className="theme-toggle-btn" 
              onClick={handleThemeToggle}
              title="Toggle Theme"
              aria-label="Toggle dark mode"
            >
              <i className={`bi ${theme === 'dark' ? 'bi-sun-fill' : 'bi-moon-stars-fill'}`} style={{ color: theme === 'dark' ? '#fbbf24' : '' }}></i>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Workspace Container */}
      <main className="container-fluid px-md-5 my-4">
        <div className="row g-4">
          
          {/* Left Sidebar Pane: Input Form (4 cols) */}
          <div className="col-lg-4">
            <div className="card custom-card sidebar-form-card p-4 sticky-form">
              <div className="d-flex align-items-center gap-2 mb-3">
                <div className="icon-circle bg-primary-subtle text-primary">
                  <i className="bi bi-pen-fill"></i>
                </div>
                <h4 className="mb-0 fw-bold">Assignment Details</h4>
              </div>
              <p className="text-muted small mb-4">
                Enter your assignment question. EduAssist AI will teach you the concepts step-by-step before showing the solution.
              </p>
              
              <form onSubmit={handleFormSubmit} className={validated ? 'was-validated' : ''} noValidate>
                <div className="row g-3">
                  {/* Subject Select */}
                  <div className="col-12">
                    <label htmlFor="subjectSelect" className="form-label">Subject <span className="text-danger">*</span></label>
                    <select 
                      className="form-select" 
                      id="subjectSelect" 
                      value={subject} 
                      onChange={(e) => setSubject(e.target.value)}
                      required
                    >
                      <option value="" disabled>Select Subject...</option>
                      <option value="Java">Java</option>
                      <option value="Python">Python</option>
                      <option value="C">C</option>
                      <option value="C++">C++</option>
                      <option value="Data Structures">Data Structures</option>
                      <option value="DBMS">DBMS</option>
                      <option value="Operating Systems">Operating Systems</option>
                      <option value="Computer Networks">Computer Networks</option>
                      <option value="Artificial Intelligence">Artificial Intelligence</option>
                      <option value="Machine Learning">Machine Learning</option>
                      <option value="Web Development">Web Development</option>
                      <option value="Other">Other</option>
                    </select>
                    <div className="invalid-feedback">Please select a subject.</div>
                  </div>

                  {/* Custom Subject Input */}
                  {subject === 'Other' && (
                    <div className="col-12 animate-fade-in">
                      <label htmlFor="customSubjectInput" className="form-label">Specify Subject <span className="text-danger">*</span></label>
                      <input 
                        type="text" 
                        className="form-control" 
                        id="customSubjectInput" 
                        value={customSubject}
                        onChange={(e) => setCustomSubject(e.target.value)}
                        placeholder="Enter custom subject name" 
                        required
                      />
                      <div className="invalid-feedback">Please specify the subject.</div>
                    </div>
                  )}

                  {/* Topic input */}
                  <div className="col-12">
                    <label htmlFor="topicInput" className="form-label">Topic <span className="text-danger">*</span></label>
                    <input 
                      type="text" 
                      className="form-control" 
                      id="topicInput" 
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="e.g., Binary Search, Normalization" 
                      required
                    />
                    <div className="invalid-feedback">Please enter the assignment topic.</div>
                  </div>

                  {/* Assignment Question */}
                  <div className="col-12">
                    <label htmlFor="questionInput" className="form-label">Assignment Question <span className="text-danger">*</span></label>
                    <textarea 
                      className="form-control" 
                      id="questionInput" 
                      rows="7" 
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      placeholder="Paste or type your assignment question here..." 
                      required
                    ></textarea>
                    <div className="invalid-feedback">Please enter the assignment question.</div>
                  </div>

                  {/* Form buttons */}
                  <div className="col-12 d-flex gap-2 mt-3">
                    <button type="button" className="btn btn-secondary-custom flex-fill" onClick={handleReset}>
                      <i className="bi bi-arrow-counterclockwise"></i> Reset
                    </button>
                    <button type="submit" className="btn btn-primary-custom flex-fill">
                      <i className="bi bi-cpu"></i> Generate Guide
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>

          {/* Right Workspace Pane: Output and Placeholders (8 cols) */}
          <div className="col-lg-8" ref={resultsRef}>
            
            {/* Placeholder state */}
            {!guideData && (
              <div id="placeholderCard" className="card custom-card placeholder-card p-5 text-center">
                <div className="placeholder-icon mb-4">
                  <i className="bi bi-journal-code text-primary"></i>
                </div>
                <h3 className="fw-bold mb-2">Your Interactive Learning Space</h3>
                <p className="text-muted mx-auto" style={{ maxWidth: '500px' }}>
                  Provide the assignment topic and question in the form on the left. EduAssist AI will generate a comprehensive, structured learning guide containing step-by-step explanations, interactive code examples, viva preparation, and complete academic answers.
                </p>
                <div className="row g-3 justify-content-center mt-4" style={{ maxWidth: '600px' }}>
                  <div className="col-md-4">
                    <div className="p-3 border border-dashed rounded-3 bg-light-subtle">
                      <i className="bi bi-book-half text-primary fs-3 d-block mb-2"></i>
                      <span className="fw-semibold small">Concept Explanations</span>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="p-3 border border-dashed rounded-3 bg-light-subtle">
                      <i className="bi bi-check2-circle text-success fs-3 d-block mb-2"></i>
                      <span className="fw-semibold small">Structured Solutions</span>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="p-3 border border-dashed rounded-3 bg-light-subtle">
                      <i className="bi bi-award-fill text-warning fs-3 d-block mb-2"></i>
                      <span className="fw-semibold small">Viva & Interview Prep</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Results output pane */}
            {guideData && (
              <div id="resultsContainer" className="results-container">
                
                {/* Global Toolbar */}
                <div className="card custom-card p-3 mb-4 sticky-results-header">
                  <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
                    <div>
                      <span className="badge bg-primary-subtle text-primary mb-1">{metaSubject}</span>
                      <h3 className="mb-0 fw-bold">{metaTopic}</h3>
                    </div>
                    <div className="d-flex gap-2">
                      <button className="btn btn-action-global" onClick={handleCopyEntireGuide} title="Copy entire guide to clipboard">
                        <i className="bi bi-copy"></i> Copy Entire Guide
                      </button>
                      <button className="btn btn-action-global" onClick={handleDownloadPdf} title="Download guide as PDF">
                        <i className="bi bi-filetype-pdf text-danger"></i> Download PDF
                      </button>
                    </div>
                  </div>
                </div>

                {/* Vertically Stacked Cards */}
                <div className="d-flex flex-column gap-4" id="fullGuideBody">

                  {/* Card 1: Concept Explanation */}
                  <div className="card custom-card section-card">
                    <div className="section-header">
                      <h4 className="section-title"><i className="bi bi-journal-text text-primary"></i> 1. Concept Explanation</h4>
                      <button 
                        className="btn btn-copy-section" 
                        onClick={() => handleCopySection("Concept Explanation", guideData.concept_explanation)}
                      >
                        <i className="bi bi-copy"></i> Copy
                      </button>
                    </div>
                    <div className="section-content" dangerouslySetInnerHTML={getParsedHtml(guideData.concept_explanation)} />
                  </div>

                  {/* Card 2: Learning Objectives */}
                  <div className="card custom-card section-card">
                    <div className="section-header">
                      <h4 className="section-title"><i className="bi bi-list-check text-primary"></i> 2. Learning Objectives</h4>
                      <button 
                        className="btn btn-copy-section" 
                        onClick={() => handleCopySection("Learning Objectives", guideData.learning_objectives.map(o => `- ${o}`).join('\n'))}
                      >
                        <i className="bi bi-copy"></i> Copy
                      </button>
                    </div>
                    <div className="section-content">
                      <ul className="list-group list-group-flush bg-transparent">
                        {guideData.learning_objectives.map((obj, i) => (
                          <li key={i} className="list-group-item bg-transparent border-0 px-0 py-2 text-secondary">
                            <i className="bi bi-patch-check-fill text-primary me-2"></i>{obj}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Card 3: Step-by-Step Explanation */}
                  <div className="card custom-card section-card">
                    <div className="section-header">
                      <h4 className="section-title"><i className="bi bi-arrow-right-square text-primary"></i> 3. Step-by-Step Explanation</h4>
                      <button 
                        className="btn btn-copy-section" 
                        onClick={() => handleCopySection("Step-by-Step Explanation", guideData.step_by_step_explanation)}
                      >
                        <i className="bi bi-copy"></i> Copy
                      </button>
                    </div>
                    <div className="section-content" dangerouslySetInnerHTML={getParsedHtml(guideData.step_by_step_explanation)} />
                  </div>

                  {/* Card 4: Simple Example */}
                  <div className="card custom-card section-card">
                    <div className="section-header">
                      <h4 className="section-title"><i className="bi bi-lightbulb text-primary"></i> 4. Simple Example</h4>
                      <button 
                        className="btn btn-copy-section" 
                        onClick={() => handleCopySection("Simple Example", guideData.simple_example)}
                      >
                        <i className="bi bi-copy"></i> Copy
                      </button>
                    </div>
                    <div className="section-content" dangerouslySetInnerHTML={getParsedHtml(guideData.simple_example)} />
                  </div>

                  {/* Card 5: Assignment Solution */}
                  <div className="card custom-card section-card border-success-subtle shadow-success-hover">
                    <div className="section-header border-success-subtle">
                      <h4 className="section-title text-success"><i className="bi bi-file-earmark-check text-success"></i> 5. Assignment Solution</h4>
                      <button 
                        className="btn btn-copy-section btn-outline-success" 
                        onClick={() => handleCopySection("Assignment Solution", guideData.assignment_solution)}
                      >
                        <i className="bi bi-copy"></i> Copy Solution
                      </button>
                    </div>
                    <div className="section-content" dangerouslySetInnerHTML={getParsedHtml(guideData.assignment_solution)} />
                  </div>

                  {/* Card 6: Code Example */}
                  {showCodeCard && (
                    <div className="card custom-card section-card" id="codeCard">
                      <div className="section-header">
                        <h4 className="section-title"><i className="bi bi-code-slash text-primary"></i> 6. Code Example</h4>
                        <button 
                          className="btn btn-copy-section" 
                          onClick={() => handleCopySection("Code Example", `${guideData.code_example.explanation}\n\n${guideData.code_example.code}`)}
                        >
                          <i className="bi bi-copy"></i> Copy
                        </button>
                      </div>
                      <div className="section-content">
                        <div className="mb-3" dangerouslySetInnerHTML={getParsedHtml(guideData.code_example.explanation)} />
                        <div className="position-relative">
                          <div className="badge bg-secondary position-absolute top-0 end-0 m-2">{guideData.code_example.language}</div>
                          <pre><code className="text-light">{guideData.code_example.code}</code></pre>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Card 7: Complexity Analysis */}
                  {showComplexityCard && (
                    <div className="card custom-card section-card" id="complexityCard">
                      <div className="section-header">
                        <h4 className="section-title"><i className="bi bi-bar-chart text-primary"></i> 7. Complexity Analysis</h4>
                        <button 
                          className="btn btn-copy-section" 
                          onClick={() => handleCopySection("Complexity Analysis", `Time Complexity: ${guideData.complexity_analysis.time_complexity}\nSpace Complexity: ${guideData.complexity_analysis.space_complexity}\n\nExplanation:\n${guideData.complexity_analysis.explanation}`)}
                        >
                          <i className="bi bi-copy"></i> Copy
                        </button>
                      </div>
                      <div className="section-content">
                        <div className="d-flex gap-3 mb-3 flex-wrap">
                          <div>
                            <span className="text-muted d-block small fw-bold">TIME COMPLEXITY</span>
                            <span className="badge badge-complexity badge-time">{guideData.complexity_analysis.time_complexity}</span>
                          </div>
                          <div>
                            <span className="text-muted d-block small fw-bold">SPACE COMPLEXITY</span>
                            <span className="badge badge-complexity badge-space">{guideData.complexity_analysis.space_complexity}</span>
                          </div>
                        </div>
                        <div dangerouslySetInnerHTML={getParsedHtml(guideData.complexity_analysis.explanation)} />
                      </div>
                    </div>
                  )}

                  {/* Card 8: Important Key Points */}
                  <div className="card custom-card section-card">
                    <div className="section-header">
                      <h4 className="section-title"><i className="bi bi-key text-primary"></i> 8. Important Key Points</h4>
                      <button 
                        className="btn btn-copy-section" 
                        onClick={() => handleCopySection("Important Key Points", guideData.important_key_points.map((p, i) => `${i+1}. ${p}`).join('\n'))}
                      >
                        <i className="bi bi-copy"></i> Copy
                      </button>
                    </div>
                    <div className="section-content">
                      <ol className="list-group list-group-numbered bg-transparent">
                        {guideData.important_key_points.map((point, i) => (
                          <li key={i} className="list-group-item bg-transparent border-0 px-0 py-2 text-secondary">{point}</li>
                        ))}
                      </ol>
                    </div>
                  </div>

                  {/* Card 9: Viva Questions */}
                  <div className="card custom-card section-card">
                    <div className="section-header">
                      <h4 className="section-title"><i className="bi bi-chat-left-quote text-primary"></i> 9. Viva Questions</h4>
                      <button 
                        className="btn btn-copy-section" 
                        onClick={() => handleCopySection("Viva Questions", guideData.viva_questions.map((v, i) => `Q${i+1}: ${v.question}\nAnswer: ${v.answer}`).join('\n\n'))}
                      >
                        <i className="bi bi-copy"></i> Copy
                      </button>
                    </div>
                    <div className="section-content">
                      {guideData.viva_questions.map((viva, idx) => (
                        <div className="qa-card" key={idx}>
                          <div className="qa-q">Q{idx + 1}: {viva.question}</div>
                          <div className="qa-a"><span className="fw-semibold text-success">Answer:</span> {viva.answer}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Card 10: Practice Questions */}
                  <div className="card custom-card section-card border-dashed">
                    <div className="section-header">
                      <h4 className="section-title text-indigo"><i className="bi bi-pencil-square text-indigo"></i> 10. Practice Questions</h4>
                      <button 
                        className="btn btn-copy-section" 
                        onClick={() => handleCopySection("Practice Questions", guideData.practice_questions.map(q => `- ${q}`).join('\n'))}
                      >
                        <i className="bi bi-copy"></i> Copy
                      </button>
                    </div>
                    <div className="section-content">
                      <ul className="practice-list">
                        {guideData.practice_questions.map((q, i) => (
                          <li key={i} className="practice-item">{q}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Card 11: Interview Prep */}
                  <div className="card custom-card section-card">
                    <div className="section-header">
                      <h4 className="section-title"><i className="bi bi-briefcase text-primary"></i> 11. Interview Prep</h4>
                      <button 
                        className="btn btn-copy-section" 
                        onClick={() => handleCopySection("Interview Prep", guideData.interview_questions.map((q, i) => `Q${i+1}: ${q.question}\nAnswer: ${q.answer}`).join('\n\n'))}
                      >
                        <i className="bi bi-copy"></i> Copy
                      </button>
                    </div>
                    <div className="section-content">
                      {guideData.interview_questions.map((qna, idx) => (
                        <div className="qa-card" key={idx}>
                          <div className="qa-q">Q{idx + 1}: {qna.question}</div>
                          <div className="qa-a"><span className="fw-semibold text-indigo">Answer:</span> {qna.answer}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Card 12: Short Summary */}
                  <div className="card custom-card section-card">
                    <div className="section-header">
                      <h4 className="section-title"><i className="bi bi-file-text text-primary"></i> 12. Short Summary</h4>
                      <button 
                        className="btn btn-copy-section" 
                        onClick={() => handleCopySection("Short Summary", guideData.short_summary)}
                      >
                        <i className="bi bi-copy"></i> Copy
                      </button>
                    </div>
                    <div className="section-content" dangerouslySetInnerHTML={getParsedHtml(guideData.short_summary)} />
                  </div>

                </div>
              </div>
            )}

          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center mt-5">
        <div className="container-fluid px-md-5">
          <div className="d-flex justify-content-between flex-wrap align-items-center gap-3">
            <p className="mb-0 text-muted small"><strong>EduAssist AI</strong> &bull; Guided Learning TA Agent</p>
            <p className="mb-0 text-muted small">Designed to promote conceptual understanding over memorization.</p>
          </div>
        </div>
      </footer>

      {/* Loading Overlay */}
      {loading && (
        <div className="loading-overlay active">
          <div className="loading-box">
            <div className="loading-spinner"></div>
            <div className="loading-text">Consulting Professor Gemini...</div>
            <div className="loading-subtext">{loadingSubtext}</div>
          </div>
        </div>
      )}

      {/* Success/Error Toast Notifications */}
      <div className="toast-container position-fixed bottom-0 end-0 p-3" style={{ zIndex: 1100 }}>
        <div className={`toast custom-toast ${toast.show ? 'show' : ''}`} role="alert" aria-live="assertive" aria-atomic="true">
          <div className="toast-body d-flex align-items-center justify-content-between py-3">
            <div className={`d-flex align-items-center gap-2 ${toast.isError ? 'text-danger' : 'text-success'}`}>
              <i className={`bi ${toast.isError ? 'bi-exclamation-triangle-fill' : 'bi-check-circle-fill'} fs-5`}></i>
              <span className="fw-semibold">{toast.message}</span>
            </div>
            <button type="button" className="btn-close" onClick={() => setToast(prev => ({ ...prev, show: false }))} aria-label="Close"></button>
          </div>
        </div>
      </div>
    </>
  );
}
