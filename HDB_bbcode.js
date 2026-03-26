// ==UserScript==
// @name         HDBits Description Cross Post
// @version      1.0
// @description  Rehost HDB images on PTPImg and replace them in the description bbcode.
// @author       MiM
// @grant        GM_xmlhttpRequest
// @match        https://hdbits.org/details.php?id=*
// @icon         https://hdbits.org/favicon.ico
// @connect      img.hdbits.org
// @connect      hdbits.org
// @connect      ptpimg.me
// ==/UserScript==

const PTPIMG_API_KEY = "PTPIMG_API_KEY";
const HDB_USERNAME = "USERNAME";
const HDB_PASSKEY =
  "HDB_PASSKEY";
const IMAGE_SIZE = 350;

var desc, modified_desc;
var active = false;

function addControlsToTable() {
  const table = document.getElementById("details");
  if (!table) return;

  let newRow = table.insertRow(-1);
  let cell = newRow.insertCell(0);
  cell.innerHTML = `
    <div class="label" style="margin-bottom: 5px;">Actions:</div>
    <div style="display: flex; gap: 10px; justify-content: flex-start; flex-wrap: wrap;">
        <button type="button" id="btn-show-descr" class="btn"
            style="margin: 0; padding: 4px 12px; white-space: nowrap; width: auto; min-width: max-content;">
            Show Description
        </button>
        <button type="button" id="btn-rehost" class="btn"
            style="margin: 0; padding: 4px 12px; white-space: nowrap; width: auto; min-width: max-content;">
            Rehost Images
        </button>
    </div>
`;
  newRow = table.insertRow(-1);
  cell = newRow.insertCell(0);
  cell.innerHTML = `<div class="container" style="width: 100%; text-align: center;">
    <textarea
        id="bbcode-descr"
        placeholder=""
        style="
            display: none;
            margin: 10px auto;
            width: 85%;
            height: 500px;
            padding: 10px;
            box-sizing: border-box;
            border: 1px solid #ccc;
            border-radius: 4px;
            font-family: monospace;
            resize: vertical;
        "
    ></textarea>
</div>
`;

  document
    .getElementById("btn-show-descr")
    .addEventListener("click", async () => {
      const textarea = document.getElementById("bbcode-descr");
      const btn = document.getElementById("btn-show-descr");
      if (active) {
        btn.textContent = "Show Description";
        textarea.style.display = "none";
        active = false;
      } else {
        textarea.value = desc;
        active = true;
        btn.textContent = "Hide Description";
        textarea.style.display = "block";
      }
    });

  document.getElementById("btn-rehost").addEventListener("click", async () => {
    await rehostImages();
    active = false;
    const btn = document.getElementById("btn-show-descr");
    const textarea = document.getElementById("bbcode-descr");
    btn.textContent = "Original Description";
    textarea.style.display = "block";
    textarea.value = modified_desc;
  });
}

async function rehostImages() {
  // need to rehost the smilies and such, anything in the /pic folder.
  //"https://hdbits.org/pic/smilies/drunk.gif";
  var matchLink,
    matchImage,
    matchedImage,
    newURL,
    newImage,
    newBBCode,
    hdbImageID;
  const linkedImageRegex =
    /(\[url=[^\[\]]*\]\s*\[img\][^\[\]]*\[\/img\]\s*\[\/url\])/g;
  const linkedImageRegexGroups =
    /\[url=([^\[\]]*)\]\s*\[img\]([^\[\]]*)\[\/img\]\s*\[\/url\]/g;
  const linkedImages = modified_desc.matchAll(linkedImageRegex);
  for (const match of linkedImages) {
    matchedImage = match[0].matchAll(linkedImageRegexGroups);
    for (const image of matchedImage) {
      matchLink = image[1];
      matchedImage = image[2];
    }
    hdbImageID = hdbURLtoID(matchedImage);
    if (!matchedImage.includes("hdbits.org")) {
      // no need to replace
      continue;
    } else if (matchLink.includes("hdbits.org")) {
      newImage = await rehostImageID(hdbURLtoID(matchLink));
      newURL = newImage;
    } else {
      newImage = await rehostImageID(hdbURLtoID(matchedImage));
      newURL = matchLink;
    }
    newBBCode = `[url=${newURL}][img=${IMAGE_SIZE}]${newImage}[/img][/url]`;
    modified_desc = modified_desc.replace(match[0], newBBCode);
  }

  const unlinkedImageRegex = /(\[img\][^\[\]]*\[\/img\])/g;
  const unlinkedImageRegexGroups = /\[img\]([^\[\]]*)\[\/img\]/g;
  const unlinkedImages = modified_desc.matchAll(unlinkedImageRegex);
  for (const match of linkedImages) {
    matchedImage = match[0].matchAll(unlinkedImageRegexGroups);
    for (const image of matchedImage) {
      matchedImage = image[1];
    }
    if (matchedImage.includes("hdbits.org")) {
      newImage = await rehostImageID(hdbURLtoID(matchedImage));
      newBBCode = `[img]${newImage}[/img]`;
      modified_desc = modified_desc.replace(match[0], newBBCode);
    }
  }
}

async function runScript() {
  const params = new URLSearchParams(window.location.search);
  const torrentID = params.get("id");
  desc = await getDescription(torrentID);
  modified_desc = desc;
}

function getRowAfterTags() {
  const labels = document.querySelectorAll(".label");
  const tagsLabel = Array.from(labels).find(
    (el) => el.textContent.trim() === "Tags",
  );
  if (!tagsLabel) {
    console.error("Could not find the 'Tags' label on this page.");
    return null;
  }
  const tagsRow = tagsLabel.closest("tr");
  const targetRow = tagsRow ? tagsRow.nextElementSibling : null;

  if (targetRow && targetRow.tagName === "TR") {
    return targetRow;
  }
  return null;
}

async function getDescription(id) {
  const payload = {
    id: id,
    username: HDB_USERNAME,
    passkey: HDB_PASSKEY,
  };

  return new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      method: "POST",
      url: "https://hdbits.org/api/torrents",
      data: JSON.stringify(payload),
      headers: {
        "User-Agent": navigator.userAgent,
        "Content-Type": "application/json",
      },
      onload: function (response) {
        if (response.status !== 200) {
          reject("API error: " + response.status);
          return;
        }
        try {
          const data = JSON.parse(response.responseText);
          const descr = data.data[0].descr;
          resolve(descr);
        } catch (e) {
          reject("JSON parse error: " + e.message);
        }
      },
      onerror: (err) => reject(err),
    });
  });
}

function hdbURLtoID(url) {
  // i/t/img subdomain, followed by ID with optional extension.
  const regex =
    /(?:(?:https?:\/\/)?(?:i|t|img)\.hdbits\.org\/)([^\.]*)(?:\..*)?/i;
  return url.replace(regex, "$1");
}

async function rehostImageID(id) {
  var newImage;
  let imageUrl = `https://img.hdbits.org/getimg/${id}`;
  // store the saved uploads and use if found.
  if (window.localStorage.getItem(`hdbimage-${id}`)) {
    newImage = window.localStorage.getItem(`hdbimage-${id}`);
  } else {
    newImage = await rehostImage(imageUrl);
    window.localStorage.setItem(`hdbimage-${id}`, newImage);
  }
  return newImage;
}

async function rehostImage(imageUrl) {
  let downloadPromise = new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      method: "GET",
      url: imageUrl,
      responseType: "blob",
      onload: function (response) {
        if (response.status !== 200) {
          reject("Download failed status:", response.status);
          return;
        }
        resolve(response.response);
      },
      onerror: (err) => reject("Download error:", err),
    });
  });
  let download = await downloadPromise;
  return await uploadToPTP(download);
}

function uploadToPTP(imageBlob) {
  let ext = imageBlob.type.replace("image/", "");
  let formData = new FormData();
  formData.append("api_key", PTPIMG_API_KEY);
  formData.append("file-upload[]", imageBlob, `image.${ext}`);

  return new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      method: "POST",
      url: "https://ptpimg.me/upload.php",
      data: formData,
      headers: {
        "User-Agent": navigator.userAgent,
        Referer: "https://ptpimg.me/index.php",
      },
      onload: function (response) {
        try {
          const data = JSON.parse(response.responseText);
          if (Array.isArray(data) && data.length > 0) {
            const newURL = `https://ptpimg.me/${data[0].code}.${data[0].ext}`;
            resolve(newURL);
          } else {
            reject("Upload failed. Response data:", data);
          }
        } catch (e) {
          reject("Failed to parse JSON response:", e);
        }
      },
      onerror: (err) => console.error("Upload network error:", err),
    });
  });
}

(function () {
  "use strict";
  addControlsToTable();
  runScript();
})();
