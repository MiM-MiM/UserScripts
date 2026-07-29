// ==UserScript==
// @name         MaM Similar Torrents
// @namespace    https://www.myanonamouse.net/
// @version      1.1
// @description  Add Similar Torrents to MaM.
// @author       MiM
// @match        https://www.myanonamouse.net/t/*
// @connect      www.myanonamouse.net
// @icon         https://sas.myanonamouse.net/favicon-32x32.png?v=b
// @grant        GM.xmlHttpRequest
// @run-at       document-start
// @license      MIT
// @updateURL    https://openuserjs.org/meta/MiM/MaM_Similar_Torrents.meta.js
// @downloadURL  https://openuserjs.org/install/MiM/MaM_Similar_Torrents.user.js
// ==/UserScript==

function fetchAndFilterTable(url, tableClassName, excludeRowClassOrId, matchTitle) {
  return new Promise((resolve, reject) => {
    GM.xmlHttpRequest({
      method: "GET",
      url: url,
      headers: {
        "User-Agent": navigator.userAgent,
        "Referer": window.location.href,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
      },
      onload: function (response) {
        try {
          const parser = new DOMParser();
          const doc = parser.parseFromString(response.responseText, 'text/html');
          const table = doc.querySelector(`table.${tableClassName}`);
          if (!table) {
            console.warn(`No table found with class: ${tableClassName}`);
            resolve(null);
            return;
          }

          const rows = Array.from(table.querySelectorAll('tr'));

          if (rows.length > 0) {
            const firstRow = rows[0];
            const isHeaderRow = firstRow.querySelectorAll('th').length > 0;

            if (isHeaderRow) {
              firstRow.remove();
              rows.shift();
            }
          }
          var torTitle;
          rows.forEach(row => {
            torTitle = row.querySelector('a.torTitle');
            if (torTitle) {
              torTitle = torTitle.textContent.trim();
            }
            if (row.id === excludeRowClassOrId || matchTitle != torTitle) {
              row.remove();
            }
            torTitle = row.querySelector('a.torTitle');
          });

          resolve(table.outerHTML);
        }
        catch (err) {
          reject(err);
        }
      },
      onerror: function (error) {
        reject(error);
      }
    });
  });
}

function buildTorQuery(obj, prefix = 'tor') {
  let queryParts = [];

  for (let key in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
    let value = obj[key];

    let currentKey = prefix ? `${prefix}[${key === 'null' ? '' : key}]` : key;

    if (value !== null && typeof value === 'object') {
      if (Array.isArray(value)) {
        value.forEach(item => {
          if (item !== null && typeof item === 'object') {
            queryParts.push(buildTorQuery(item, currentKey));
          }
          else {
            queryParts.push(`${currentKey}[]=${encodeURIComponent(item)}`);
          }
        });
      }
      else {
        queryParts.push(buildTorQuery(value, currentKey));
      }
    }
    else {
      queryParts.push(`${currentKey}=${encodeURIComponent(value)}`);
    }
  }
  return queryParts.join('&');
}

(async function () {
  'use strict';

  function waitForElement(selector) {
    return new Promise(resolve => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);

      const observer = new MutationObserver((mutations, obs) => {
        const target = document.querySelector(selector);
        if (target) {
          obs.disconnect();
          resolve(target);
        }
      });
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    });
  }

  try {
    const description_row = await waitForElement('.torDetBottom');

    if (document.getElementById('injected-similar-torrents')) return;

    const torrent_id = window.location.pathname.split('/').filter(Boolean).pop();
    let title_author = '';
    let title = '';
    const titleSpan = document.querySelector('span.TorrentTitle');
    if (titleSpan) {
      title = titleSpan.textContent.trim();
    }

    const authorLinks = document.querySelectorAll('.torDetRight.torAuthors a.altColor');
    if (authorLinks.length > 0) {
      const authorsList = Array.from(authorLinks).map(link =>
        link.textContent.replace(/\u00A0/g, ' ').trim()
      ).filter(Boolean).join(' ');

      if (authorsList) {
        title_author = `${title} ${authorsList}`;
      }
    }

    const search_torrent_class = 'newTorTable';
    const torrent_exclude_identifier = `tdr-${torrent_id}`;

    const params = {
      'text': title_author,
      'srchIn': [{
        'title': true,
        'author': true
      }, 'torrents'],
      'searchType': 'all',
      'cat': {
        null: 0
      },
      'browseFlagsHideVsShow': 0,
      'unit': 1,
      'sortType': 'default',
      'startNumber': 0,
    };

    const query_params = buildTorQuery(params);
    const searchUrl = `https://www.myanonamouse.net/tor/js/loadSearch2.php?${query_params}`;
    const browseUrl = `https://www.myanonamouse.net/tor/browse.php?${query_params}`;

    const tableHtml = await fetchAndFilterTable(searchUrl, search_torrent_class, torrent_exclude_identifier, title);

    var other_torrents = document.createElement('div');
    other_torrents.id = 'injected-similar-torrents';
    other_torrents.className = 'torDetRow';
    other_torrents.style.minHeight = '5em';

    var other_torrents_left = document.createElement('div');
    other_torrents_left.className = 'torDetLeft';
    other_torrents_left.innerHTML = `Similar Torrents:<br><a href='${browseUrl}'>[Search]</a>`;

    var other_torrents_right = document.createElement('div');
    other_torrents_right.className = 'torDetRight';

    if (tableHtml) {
      other_torrents_right.innerHTML = `&nbsp;<br>${tableHtml}<br>&nbsp;`;
    }
    else {
      other_torrents_right.innerHTML = `No similar torrents found.`;
    }

    other_torrents.appendChild(other_torrents_left);
    other_torrents.appendChild(other_torrents_right);

    description_row.before(other_torrents);

  }
  catch (err) {
    console.error("Failed to inject similar torrents:", err);
  }
})();
