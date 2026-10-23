// ==UserScript==
// @name         LensDump Image Fix
// @namespace    https://github.com
// @version      1.0
// @description  Monitor all DOM and replace image tags on LensDump with blobs that use a referrer.
// @author       MiM
// @match        *://*/*
// @exclude      /^https?:\/\/(?:[a-z0-9]+\.)?lensdump\.com/
// @grant        GM_xmlhttpRequest
// @connect      l3n.co
// @connect      lensdump.com
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const CACHE_NAME = 'lensdump-media-cache';
    const USE_MD = true;
    const MAX_CACHE_ITEMS = 200;
    const targetPattern = /^https:\/\/[a-z0-9]+\.l3n\.co\/(?:i\/)?([A-Za-z0-9]+)\..*$/;

    async function limitCacheSize(cache, maxItems) {
        const keys = await cache.keys();
        if (keys.length > maxItems) {
            await cache.delete(keys[0]);
        }
    }

    function getDownloadLink(id) {
        const urlTemplate = "https://lensdump.com/i/{id}"
        return new Promise((resolve, reject) => {
            const targetUrl = urlTemplate.replace('{id}', encodeURIComponent(id));
            GM_xmlhttpRequest({
                method: 'GET',
                url: targetUrl,
                headers: {
                    'Accept': 'text/html'
                },
                onload: function(response) {
                    if (response.status >= 200 && response.status < 300) {
                        try {
                            const htmlText = response.responseText;
                            const parser = new DOMParser();
                            const doc = parser.parseFromString(htmlText, 'text/html');
                            const anchors = doc.querySelectorAll("#tab-embeds a[download]");
                            let matchedHref = null;

                            for (const anchor of anchors) {
                                const href = anchor.getAttribute('href');
                                console.log(href)
                                if (USE_MD && href && href.includes(String(id)) && href.includes(".md.")) {
                                    matchedHref = href;
                                    break;
                                } else if (!USE_MD && href && href.includes(String(id)) && !href.includes(".md.")) {
                                    matchedHref = href;
                                    break;
                                }
                            }

                            if (matchedHref) {
                                const absoluteHref = new URL(matchedHref, targetUrl).href;
                                resolve(absoluteHref);
                            } else {
                                console.warn(`[Link Extractor] No matching download link found for ID: ${id}`);
                                resolve(null);
                            }
                        } catch (parseError) {
                            console.error('[Link Extractor] Error parsing HTML:', parseError);
                            reject(parseError);
                        }
                    } else {
                        console.error(`[Link Extractor] HTTP error! Status: ${response.status} ${response.statusText}`);
                        resolve(null);
                    }
                },
                onerror: function(error) {
                    console.error('[Link Extractor] Request failed:', error);
                    reject(error);
                }
            });
        });
    }

    async function fixImage(img) {
        var src = img.src;
        if (src.startsWith(`https://wsrv.`)) {
            const params = new URLSearchParams(src);
            src = decodeURIComponent(params.get("url"));
        }
        const match = src.match(targetPattern);
        if (match && !img.hasAttribute('data-referrer-fixed')) {
            const imageId = match[1];
            const originalSrc = src;

            img.removeAttribute('src');
            img.setAttribute('data-referrer-fixed', 'true');

            try {
                const cache = await caches.open(CACHE_NAME);
                const cachedResponse = await cache.match(originalSrc);
                const baseURL = `https://lensdump.com/i/${imageId}`;

                if (cachedResponse) {
                    const blob = await cachedResponse.blob();
                    img.src = URL.createObjectURL(blob);
                    return;
                }

                (async function() {
                    // Image link expires in a day
                    const url = await getDownloadLink(imageId);
                    if (url) {
                        // Can also uncomment this and just replace the link with the timed one, ignoring cache.
                        //img.src = url;
                        GM_xmlhttpRequest({
                            method: "GET",
                            url: url,
                            headers: {
                                "Referer": baseURL
                            },
                            responseType: "blob",
                            onload: async function(response) {
                                if (response.status === 200) {
                                    const blob = response.response;
                                    const responseToCache = new Response(blob, {
                                        headers: { 'Content-Type': blob.type }
                                    });

                                    await cache.put(originalSrc, responseToCache);
                                    await limitCacheSize(cache, MAX_CACHE_ITEMS);
                                    img.src = URL.createObjectURL(blob);
                                }
                            }
                        });
                    }

                })();

            } catch (err) {
                console.error("Cache proxy failed:", err);
            }
        }
    }

    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.tagName === 'IMG') {
                    fixImage(node);
                }
                else if (node.nodeType === Node.ELEMENT_NODE) {
                    const nestedImgs = node.querySelectorAll('img');
                    nestedImgs.forEach(fixImage);
                }
            }
        }
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });
})();
