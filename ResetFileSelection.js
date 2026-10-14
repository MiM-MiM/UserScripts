// ==UserScript==
// @name         Universal File Input Reset Button
// @namespace    https://github.com/
// @version      1.0
// @description  Add a reset button to every file selection input on any page as it loads.
// @author       MiM
// @match        *://*/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function addResetButton(input) {
        if (input.dataset.hasResetBtn === 'true') return;
        input.dataset.hasResetBtn = 'true';

        const resetBtn = document.createElement('button');
        resetBtn.type = 'button';
        resetBtn.textContent = 'Reset';
        resetBtn.className = 'userscript-file-reset-btn';

        resetBtn.style.marginLeft = '6px';
        resetBtn.style.padding = '2px 8px';
        resetBtn.style.fontSize = '12px';
        resetBtn.style.cursor = 'pointer';
        resetBtn.style.borderRadius = '3px';
        resetBtn.style.border = '1px solid #ccc';
        resetBtn.style.background = '#f8f9fa';
        resetBtn.style.color = '#333';

        resetBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            input.value = '';
            input.dispatchEvent(new Event('change', { bubbles: true }));
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });

        if (input.nextSibling) {
            input.parentNode.insertBefore(resetBtn, input.nextSibling);
        } else {
            input.parentNode.appendChild(resetBtn);
        }
    }

    function scanAndApply() {
        const fileInputs = document.querySelectorAll('input[type="file"]');
        fileInputs.forEach(addResetButton);
    }

    const observer = new MutationObserver((mutations) => {
        let shouldScan = false;
        for (const mutation of mutations) {
            if (mutation.addedNodes.length > 0) {
                shouldScan = true;
                break;
            }
        }
        if (shouldScan) {
            scanAndApply();
        }
    });

    function initObserver() {
        if (document.documentElement) {
            observer.observe(document.documentElement, {
                childList: true,
                subtree: true
            });
            scanAndApply();
        } else {
            setTimeout(initObserver, 5);
        }
    }

    initObserver();
})();
