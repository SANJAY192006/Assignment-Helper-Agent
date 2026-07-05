/**
 * EduAssist AI — Multi-Page Script
 * Handles: Login · Form · Guide
 * Uses sessionStorage to pass AI data between pages
 */

/* ═══════════════════════════════════════════════════════════════════
   SHARED: Particles, Theme, Toast
   ═══════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {

    // ── Particle Background ─────────────────────────────────────────
    (function initParticles() {
        const container = document.getElementById('bgParticles');
        if (!container) return;
        if (!document.getElementById('particleKF')) {
            const s = document.createElement('style');
            s.id = 'particleKF';
            s.textContent = `@keyframes particleDrift {
                0%   { transform:translateY(0) scale(1); opacity:var(--op); }
                50%  { transform:translateY(-80px) scale(1.4); opacity:calc(var(--op)*0.3); }
                100% { transform:translateY(-160px) scale(0.6); opacity:0; }
            }`;
            document.head.appendChild(s);
        }
        for (let i = 0; i < 30; i++) {
            const p = document.createElement('div');
            const sz = (Math.random() * 2.5 + 0.5).toFixed(1);
            const l = (Math.random() * 100).toFixed(1);
            const t = (Math.random() * 100).toFixed(1);
            const d = (Math.random() * 25).toFixed(1);
            const dur = (Math.random() * 18 + 10).toFixed(1);
            const op = (Math.random() * 0.3 + 0.05).toFixed(2);
            const cols = ['rgba(99,102,241,', 'rgba(139,92,246,', 'rgba(52,211,153,', 'rgba(129,140,248,'];
            const col = cols[Math.floor(Math.random() * cols.length)];
            p.style.cssText = `
                position:absolute; border-radius:50%; pointer-events:none;
                width:${sz}px; height:${sz}px;
                left:${l}%; top:${t}%;
                background:${col}${op});
                --op:${op};
                animation:particleDrift ${dur}s ${d}s ease-in-out infinite;
            `;
            container.appendChild(p);
        }
    })();

    // ── Theme ───────────────────────────────────────────────────────
    const htmlEl = document.documentElement;
    const themeBtn = document.getElementById('themeToggleBtn');
    const themeIcon = document.getElementById('themeIcon');
    const savedTheme = localStorage.getItem('eduassist-theme') || 'dark';
    applyTheme(savedTheme);

    themeBtn?.addEventListener('click', () => {
        applyTheme(htmlEl.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });

    function applyTheme(t) {
        htmlEl.setAttribute('data-theme', t);
        localStorage.setItem('eduassist-theme', t);
        if (themeIcon) {
            themeIcon.className = t === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-stars-fill';
            themeIcon.style.color = t === 'dark' ? '#fbbf24' : '';
        }
    }

    // ── Toast ───────────────────────────────────────────────────────
    const toastEl = document.getElementById('copyToast');
    const toastMsg = document.getElementById('toastMessage');
    const toastIcon = document.getElementById('toastIcon');
    let bsToast = toastEl ? new bootstrap.Toast(toastEl, { delay: 3000 }) : null;

    window.showToast = function (msg, isError = false) {
        if (!bsToast) return;
        if (toastMsg) toastMsg.textContent = msg;
        if (toastIcon) toastIcon.className = isError
            ? 'bi bi-exclamation-circle-fill fs-5 text-danger'
            : 'bi bi-check-circle-fill fs-5 text-success';
        bsToast.show();
    };

    // ── Section copy (global, available on guide page) ──────────────
    window.copySectionText = function (id) {
        const el = document.getElementById(id);
        if (!el) return;
        navigator.clipboard.writeText(el.innerText).then(() => {
            showToast('Section copied to clipboard!');
        }).catch(() => showToast('Copy failed.', true));
    };

    /* ═══════════════════════════════════════════════════════════════
       PAGE: LOGIN
       ═══════════════════════════════════════════════════════════════ */
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        const usernameInput = document.getElementById('usernameInput');
        const passwordInput = document.getElementById('passwordInput');
        const loginBtn = document.getElementById('loginBtn');
        const loginError = document.getElementById('loginError');
        const loginErrorTxt = document.getElementById('loginErrorText');

        // Clear error on type
        [usernameInput, passwordInput].forEach(el => {
            el?.addEventListener('input', () => {
                loginError?.classList.add('d-none');
                clearFieldErr(el);
            });
        });

        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            let valid = true;

            if (!usernameInput.value.trim()) { showFieldErr(usernameInput, 'Please enter your username.'); valid = false; }
            else showFieldOk(usernameInput);
            if (!passwordInput.value.trim()) { showFieldErr(passwordInput, 'Please enter your password.'); valid = false; }
            else showFieldOk(passwordInput);

            if (!valid) return;

            loginBtn.disabled = true;
            const originalInner = loginBtn.innerHTML;
            loginBtn.innerHTML = `<span class="btn-generate-inner"><span class="spinner-border spinner-border-sm me-2"></span>Signing in...</span><span class="btn-shine"></span>`;

            try {
                const res = await fetch('/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: usernameInput.value.trim(),
                        password: passwordInput.value.trim()
                    })
                });
                const data = await res.json();

                if (!res.ok) {
                    loginBtn.disabled = false;
                    loginBtn.innerHTML = originalInner;
                    if (loginErrorTxt) loginErrorTxt.textContent = data.error || 'Login failed.';
                    loginError?.classList.remove('d-none');
                    return;
                }

                // Success — redirect to form page
                window.location.href = data.redirect || '/form';

            } catch (err) {
                loginBtn.disabled = false;
                loginBtn.innerHTML = originalInner;
                if (loginErrorTxt) loginErrorTxt.textContent = 'Network error. Please try again.';
                loginError?.classList.remove('d-none');
            }
        });
    }

    /* ═══════════════════════════════════════════════════════════════
       PAGE: REGISTER
       ═══════════════════════════════════════════════════════════════ */
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        const regUsername = document.getElementById('regUsernameInput');
        const regEmail    = document.getElementById('regEmailInput');
        const regPassword = document.getElementById('regPasswordInput');
        const regConfirm  = document.getElementById('regConfirmInput');
        const regBtn      = document.getElementById('registerBtn');
        const regError    = document.getElementById('registerError');
        const regErrorTxt = document.getElementById('registerErrorText');

        [regUsername, regEmail, regPassword, regConfirm].forEach(el => {
            el?.addEventListener('input', () => {
                regError?.classList.add('d-none');
                clearFieldErr(el);
            });
        });

        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            let valid = true;

            if (!regUsername.value.trim() || regUsername.value.trim().length < 3) {
                showFieldErr(regUsername, 'Username must be at least 3 characters.'); valid = false;
            } else showFieldOk(regUsername);

            if (!regEmail.value.trim() || !regEmail.value.includes('@')) {
                showFieldErr(regEmail, 'Please enter a valid email address.'); valid = false;
            } else showFieldOk(regEmail);

            if (!regPassword.value || regPassword.value.length < 6) {
                showFieldErr(regPassword, 'Password must be at least 6 characters.'); valid = false;
            } else showFieldOk(regPassword);

            if (regConfirm.value !== regPassword.value) {
                showFieldErr(regConfirm, 'Passwords do not match.'); valid = false;
            } else if (regConfirm.value) showFieldOk(regConfirm);

            if (!valid) return;

            regBtn.disabled = true;
            const originalInner = regBtn.innerHTML;
            regBtn.innerHTML = `<span class="btn-generate-inner"><span class="spinner-border spinner-border-sm me-2"></span>Creating account...</span><span class="btn-shine"></span>`;

            try {
                const res = await fetch('/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username:         regUsername.value.trim(),
                        email:            regEmail.value.trim(),
                        password:         regPassword.value,
                        confirm_password: regConfirm.value
                    })
                });
                const data = await res.json();

                if (!res.ok) {
                    regBtn.disabled = false;
                    regBtn.innerHTML = originalInner;
                    if (regErrorTxt) regErrorTxt.textContent = data.error || 'Registration failed.';
                    regError?.classList.remove('d-none');
                    return;
                }

                showToast('Account created! Redirecting to login...');
                setTimeout(() => { window.location.href = data.redirect || '/login'; }, 1200);

            } catch (err) {
                regBtn.disabled = false;
                regBtn.innerHTML = originalInner;
                if (regErrorTxt) regErrorTxt.textContent = 'Network error. Please try again.';
                regError?.classList.remove('d-none');
            }
        });
    }

    /* ═══════════════════════════════════════════════════════════════
       PAGE: FORM (Assignment Details)
       ═══════════════════════════════════════════════════════════════ */
    const assignmentForm = document.getElementById('assignmentForm');
    if (assignmentForm) {
        const subjectSelect = document.getElementById('subjectSelect');
        const topicInput = document.getElementById('topicInput');
        const questionInput = document.getElementById('questionInput');
        const customSubjectWrap = document.getElementById('customSubjectWrapper');
        const customSubjectInput = document.getElementById('customSubjectInput');
        const questionCharCount = document.getElementById('questionCharCount');
        const generateBtn = document.getElementById('generateBtn');
        const resetBtn = document.getElementById('resetBtn');
        const loadingOverlay = document.getElementById('loadingOverlay');
        const loadingText = document.getElementById('loadingText');
        const loadingSubtext = document.getElementById('loadingSubtext');
        const loadingProgressFill = document.getElementById('loadingProgressFill');
        const generateProgress = document.getElementById('generateProgress');
        const progressBarFill = document.getElementById('progressBarFill');
        const progressLabel = document.getElementById('progressLabel');

        // ── Character counter ──
        function updateCharCount() {
            if (!questionInput || !questionCharCount) return;
            const len = questionInput.value.length;
            const max = 5000;
            questionCharCount.textContent = `${len.toLocaleString()} / ${max.toLocaleString()}`;
            questionCharCount.className = 'char-counter';
            if (len > max * 0.85) questionCharCount.classList.add('warn');
            if (len >= max) questionCharCount.classList.add('limit');
        }
        questionInput?.addEventListener('input', () => { updateCharCount(); clearFieldErr(questionInput); });
        updateCharCount();

        // ── Custom subject toggle ──
        subjectSelect?.addEventListener('change', () => {
            clearFieldErr(subjectSelect);
            if (subjectSelect.value === 'Other') {
                customSubjectWrap?.classList.remove('d-none');
                customSubjectInput?.setAttribute('required', 'required');
                customSubjectInput?.focus();
            } else {
                customSubjectWrap?.classList.add('d-none');
                customSubjectInput?.removeAttribute('required');
                if (customSubjectInput) customSubjectInput.value = '';
            }
        });

        topicInput?.addEventListener('input', () => clearFieldErr(topicInput));
        customSubjectInput?.addEventListener('input', () => clearFieldErr(customSubjectInput));

        // ── Validate ──
        function validateForm() {
            let ok = true;
            if (!subjectSelect.value) { showFieldErr(subjectSelect, 'Please select a subject.'); ok = false; }
            else showFieldOk(subjectSelect);

            if (subjectSelect.value === 'Other' && !customSubjectInput.value.trim()) {
                showFieldErr(customSubjectInput, 'Please specify your subject.'); ok = false;
            } else if (customSubjectInput) showFieldOk(customSubjectInput);

            if (!topicInput.value.trim()) { showFieldErr(topicInput, 'Please enter the topic.'); ok = false; }
            else showFieldOk(topicInput);

            const q = questionInput.value.trim();
            if (!q) { showFieldErr(questionInput, 'Please enter your assignment question.'); ok = false; }
            else if (q.length < 10) { showFieldErr(questionInput, 'Question is too short. Please add more detail.'); ok = false; }
            else showFieldOk(questionInput);

            return ok;
        }

        // ── Loading messages ──
        const loadingMessages = [
            "Consulting Professor Gemini...",
            "Analyzing your assignment...",
            "Formulating concept explanations...",
            "Building step-by-step breakdown...",
            "Creating code examples...",
            "Calculating complexity analysis...",
            "Preparing viva questions...",
            "Compiling practice exercises...",
            "Generating interview prep...",
            "Polishing your guide...",
        ];
        let msgIdx = 0, progVal = 0, loadInterval, progInterval;

        function showLoading() {
            loadingOverlay.classList.add('active');
            msgIdx = 0; progVal = 0;
            if (loadingProgressFill) loadingProgressFill.style.width = '0%';
            if (loadingText) loadingText.textContent = loadingMessages[0];

            loadInterval = setInterval(() => {
                msgIdx = (msgIdx + 1) % loadingMessages.length;
                if (loadingText) loadingText.textContent = loadingMessages[msgIdx];
                if (loadingSubtext) loadingSubtext.textContent = 'This may take a few seconds...';
            }, 2400);

            progInterval = setInterval(() => {
                progVal = Math.min(progVal + (Math.random() * 4 + 1), 88);
                if (loadingProgressFill) loadingProgressFill.style.width = progVal + '%';
            }, 500);
        }

        function hideLoading() {
            clearInterval(loadInterval);
            clearInterval(progInterval);
            if (loadingProgressFill) loadingProgressFill.style.width = '100%';
            setTimeout(() => loadingOverlay.classList.remove('active'), 350);
        }

        // ── Inline progress (small bar under button) ──
        function showInlineProgress() {
            generateProgress?.classList.remove('d-none');
            progVal = 0;
            if (progressBarFill) progressBarFill.style.width = '0%';
            const msgs = ['Generating...', 'Analyzing...', 'Writing...', 'Preparing...'];
            let mi = 0;
            if (progressLabel) progressLabel.textContent = msgs[0];
            const iv = setInterval(() => {
                progVal = Math.min(progVal + Math.random() * 5 + 2, 88);
                if (progressBarFill) progressBarFill.style.width = progVal + '%';
                mi = (mi + 1) % msgs.length;
                if (progressLabel) progressLabel.textContent = msgs[mi];
            }, 700);
            return iv;
        }

        // ── Submit ──
        assignmentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!validateForm()) {
                const firstErr = assignmentForm.querySelector('.is-invalid');
                if (firstErr) firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return;
            }

            const selectedSubject = subjectSelect.value;
            const subject = selectedSubject === 'Other' ? customSubjectInput.value.trim() : selectedSubject;
            const topic = topicInput.value.trim();
            const question = questionInput.value.trim();

            generateBtn.disabled = true;
            showLoading();
            const progIv = showInlineProgress();

            try {
                const res = await fetch('/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ subject, topic, question })
                });
                const data = await res.json();

                clearInterval(progIv);
                hideLoading();
                generateBtn.disabled = false;
                generateProgress?.classList.add('d-none');

                if (!res.ok) {
                    showToast(data.error || 'An error occurred. Please try again.', true);
                    return;
                }

                // Store result in sessionStorage and navigate to guide
                sessionStorage.setItem('eduassist-guide', JSON.stringify(data));
                sessionStorage.setItem('eduassist-meta', JSON.stringify({ subject, topic, question }));
                window.location.href = '/guide';

            } catch (err) {
                clearInterval(progIv);
                hideLoading();
                generateBtn.disabled = false;
                generateProgress?.classList.add('d-none');
                showToast('Network error — please check your connection.', true);
            }
        });

        // ── Reset ──
        resetBtn?.addEventListener('click', () => {
            assignmentForm.reset();
            assignmentForm.querySelectorAll('.is-invalid,.is-valid').forEach(el => el.classList.remove('is-invalid', 'is-valid'));
            assignmentForm.querySelectorAll('.invalid-feedback').forEach(el => el.style.display = 'none');
            customSubjectWrap?.classList.add('d-none');
            customSubjectInput?.removeAttribute('required');
            if (customSubjectInput) customSubjectInput.value = '';
            updateCharCount();
            generateProgress?.classList.add('d-none');
        });
    }

    /* ═══════════════════════════════════════════════════════════════
       PAGE: GUIDE (Learning Guide Workspace)
       ═══════════════════════════════════════════════════════════════ */
    const guideWorkspace = document.getElementById('guideWorkspace');
    const noDataState = document.getElementById('noDataState');

    if (guideWorkspace) {
        // ── Load data from sessionStorage ──
        const rawGuide = sessionStorage.getItem('eduassist-guide');
        const rawMeta = sessionStorage.getItem('eduassist-meta');

        if (!rawGuide) {
            // Show the no-data state
            noDataState?.classList.remove('hidden');
            guideWorkspace.classList.add('d-none');
            return;
        }

        const guideData = JSON.parse(rawGuide);
        const metaData = rawMeta ? JSON.parse(rawMeta) : {};

        guideWorkspace.classList.remove('d-none');
        noDataState?.classList.add('hidden');

        // ── Populate Header ──
        const guideMeta = document.getElementById('guideMeta');
        const guideTitle = document.getElementById('guideTitle');
        const guideQuestionPrev = document.getElementById('guideQuestionPreview');

        if (guideMeta) guideMeta.textContent = (metaData.subject || 'Subject') + ' · ' + (metaData.topic || 'Topic');
        if (guideTitle) guideTitle.textContent = metaData.topic || 'Learning Guide';
        if (guideQuestionPrev) guideQuestionPrev.textContent = metaData.question || '';

        // ── Markdown renderer ──
        function md(text) {
            if (!text) return '<em style="color:var(--text-muted)">Not available.</em>';
            if (typeof marked !== 'undefined') {
                marked.setOptions({ breaks: true, gfm: true });
                return marked.parse(String(text));
            }
            return String(text)
                .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.+?)\*/g, '<em>$1</em>')
                .replace(/`(.+?)`/g, '<code>$1</code>')
                .replace(/\n/g, '<br>');
        }

        function safe(str) {
            return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }

        // ── Render all sections ──

        // 01 Concept
        const conceptContent = document.getElementById('concept-content');
        if (conceptContent) conceptContent.innerHTML = md(guideData.concept_explanation);

        // 02 Objectives
        const objectivesContent = document.getElementById('objectives-content');
        if (objectivesContent) {
            const objs = Array.isArray(guideData.learning_objectives) ? guideData.learning_objectives : [];
            objectivesContent.innerHTML = objs.length
                ? `<ul class="objectives-list">${objs.map(o => `<li><i class="bi bi-patch-check-fill"></i><span>${safe(o)}</span></li>`).join('')}</ul>`
                : '<p><em>No objectives listed.</em></p>';
        }

        // 03 Steps
        const stepsContent = document.getElementById('steps-content');
        if (stepsContent) stepsContent.innerHTML = md(guideData.step_by_step_explanation);

        // 04 Example
        const exampleContent = document.getElementById('example-content');
        if (exampleContent) exampleContent.innerHTML = md(guideData.simple_example);

        // 05 Solution
        const solutionContent = document.getElementById('solution-content');
        if (solutionContent) solutionContent.innerHTML = md(guideData.assignment_solution);

        // 06 Code
        const codeEx = guideData.code_example;
        const codeCard = document.getElementById('codeCard');
        if (codeEx && codeEx.language && codeEx.language.toUpperCase() !== 'N/A' && codeEx.code?.trim()) {
            const langBadge = document.getElementById('code-language-badge');
            const codeSnip = document.getElementById('code-snippet');
            const codeExpl = document.getElementById('code-explanation');
            if (langBadge) langBadge.textContent = codeEx.language;
            if (codeSnip) codeSnip.textContent = codeEx.code;
            if (codeExpl) codeExpl.innerHTML = md(codeEx.explanation);
        } else {
            codeCard?.classList.add('d-none');
        }

        // 07 Complexity
        const comp = guideData.complexity_analysis;
        const complexityCard = document.getElementById('complexityCard');
        if (comp && comp.time_complexity && comp.time_complexity.toUpperCase() !== 'N/A') {
            const timeBadge = document.getElementById('time-complexity-badge');
            const spaceBadge = document.getElementById('space-complexity-badge');
            const compExpl = document.getElementById('complexity-explanation');
            if (timeBadge) timeBadge.textContent = comp.time_complexity;
            if (spaceBadge) spaceBadge.textContent = comp.space_complexity || 'N/A';
            if (compExpl) compExpl.innerHTML = md(comp.explanation);
        } else {
            complexityCard?.classList.add('d-none');
        }

        // 08 Key Points
        const keypointsContent = document.getElementById('keypoints-content');
        if (keypointsContent) {
            const pts = Array.isArray(guideData.important_key_points) ? guideData.important_key_points : [];
            keypointsContent.innerHTML = pts.length
                ? `<ul class="keypoints-list">${pts.map(p => `<li><i class="bi bi-star-fill"></i><span>${safe(p)}</span></li>`).join('')}</ul>`
                : '<p><em>No key points listed.</em></p>';
        }

        // 09 Viva
        const vivaContent = document.getElementById('viva-content');
        if (vivaContent) {
            const qs = Array.isArray(guideData.viva_questions) ? guideData.viva_questions : [];
            vivaContent.innerHTML = qs.length
                ? qs.map((q, i) => `
                    <div class="qa-card">
                        <div class="qa-q"><i class="bi bi-question-circle-fill" style="color:var(--accent-light)"></i>Q${i + 1}: ${safe(q.question)}</div>
                        <div class="qa-a"><strong style="color:var(--accent-light)">Answer: </strong>${safe(q.answer)}</div>
                    </div>`).join('')
                : '<p><em>No viva questions generated.</em></p>';
        }

        // 10 Practice
        const practiceContent = document.getElementById('practice-content');
        if (practiceContent) {
            const pqs = Array.isArray(guideData.practice_questions) ? guideData.practice_questions : [];
            practiceContent.innerHTML = pqs.length
                ? `<ol style="padding-left:1.3rem; color:var(--text-secondary);">${pqs.map(p => `<li style="margin-bottom:0.5rem;">${safe(p)}</li>`).join('')}</ol>`
                : '<p><em>No practice questions generated.</em></p>';
        }

        // 11 Interview
        const interviewContent = document.getElementById('interview-content');
        if (interviewContent) {
            const iqs = Array.isArray(guideData.interview_questions) ? guideData.interview_questions : [];
            interviewContent.innerHTML = iqs.length
                ? iqs.map((q, i) => `
                    <div class="interview-card">
                        <div class="qa-q"><i class="bi bi-briefcase-fill me-2" style="color:var(--indigo-color)"></i>Q${i + 1}: ${safe(q.question)}</div>
                        <div class="qa-a"><strong style="color:var(--indigo-color)">Answer: </strong>${safe(q.answer)}</div>
                    </div>`).join('')
                : '<p><em>No interview questions generated.</em></p>';
        }

        // 12 Summary
        const summaryContent = document.getElementById('summary-content');
        if (summaryContent) summaryContent.innerHTML = md(guideData.short_summary);

        // ── Init collapsibles ──
        document.querySelectorAll('.collapsible-content').forEach(el => {
            el.style.maxHeight = el.scrollHeight + 'px';
        });

        // ── Collapse toggles ──
        document.addEventListener('click', e => {
            const btn = e.target.closest('.section-collapse-btn');
            if (!btn) return;
            const tid = btn.getAttribute('data-target');
            const target = document.getElementById(tid);
            if (!target) return;
            const expanded = btn.getAttribute('aria-expanded') === 'true';
            if (expanded) {
                target.style.maxHeight = target.scrollHeight + 'px';
                target.offsetHeight;
                target.classList.add('collapsed');
                btn.setAttribute('aria-expanded', 'false');
            } else {
                target.classList.remove('collapsed');
                target.style.maxHeight = target.scrollHeight + 'px';
                btn.setAttribute('aria-expanded', 'true');
                setTimeout(() => { if (!target.classList.contains('collapsed')) target.style.maxHeight = 'none'; }, 380);
            }
        });

        // ── Section nav pills scroll to section ──
        document.querySelectorAll('.section-nav-pill').forEach(pill => {
            pill.addEventListener('click', () => {
                const target = document.getElementById(pill.dataset.target);
                if (!target) return;
                const offset = 130;
                const top = target.getBoundingClientRect().top + window.scrollY - offset;
                window.scrollTo({ top, behavior: 'smooth' });
                document.querySelectorAll('.section-nav-pill').forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
            });
        });

        // ── Code copy button ──
        document.getElementById('codeCopyBtn')?.addEventListener('click', () => {
            const code = document.getElementById('code-snippet');
            if (!code) return;
            navigator.clipboard.writeText(code.textContent).then(() => showToast('Code copied!'));
        });

        // ── Copy entire guide ──
        document.getElementById('btnCopyEntire')?.addEventListener('click', () => {
            const body = document.getElementById('fullGuideBody');
            if (!body) return;
            navigator.clipboard.writeText(body.innerText).then(() => showToast('Full guide copied!'));
        });

        // ── PDF Export ──
        document.getElementById('btnDownloadPdf')?.addEventListener('click', async () => {
            if (typeof html2pdf === 'undefined') {
                showToast('PDF library not loaded yet. Please wait.', true);
                return;
            }
            showToast('Generating PDF — please wait...');
            const element = document.getElementById('guideWorkspace');

            // Add temporary exporting styles
            element.classList.add('pdf-exporting');

            const opt = {
                margin: [10, 12, 10, 12],
                filename: `EduAssist-${metaData.topic || 'guide'}.pdf`,
                image: { type: 'jpeg', quality: 0.96 },
                html2canvas: { scale: 2, useCORS: true, logging: false },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
            };
            try {
                // Wait slightly for DOM to paint layout change
                await new Promise(r => setTimeout(r, 450));
                await html2pdf().set(opt).from(element).save();
                showToast('PDF downloaded!');
            } catch (err) {
                console.error(err);
                showToast('PDF generation failed.', true);
            } finally {
                // Remove exporting styles
                element.classList.remove('pdf-exporting');
            }
        });

        // ── Back to top ──
        document.getElementById('backToTopBtn')?.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    /* ═══════════════════════════════════════════════════════════════
       SHARED: Field Validation Helpers
       ═══════════════════════════════════════════════════════════════ */
    function showFieldErr(el, msg) {
        el.classList.add('is-invalid'); el.classList.remove('is-valid');
        const group = el.closest('.field-group') || el.parentElement;
        const fb = group?.querySelector('.invalid-feedback');
        if (fb) { fb.textContent = msg; fb.style.display = 'block'; }
    }
    function showFieldOk(el) {
        el.classList.remove('is-invalid'); el.classList.add('is-valid');
        const group = el.closest('.field-group') || el.parentElement;
        const fb = group?.querySelector('.invalid-feedback');
        if (fb) fb.style.display = 'none';
    }
    function clearFieldErr(el) {
        el.classList.remove('is-invalid', 'is-valid');
        const group = el.closest('.field-group') || el.parentElement;
        const fb = group?.querySelector('.invalid-feedback');
        if (fb) fb.style.display = 'none';
    }

});
