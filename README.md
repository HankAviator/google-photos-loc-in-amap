# Google Photos Open in AMap

Userscript for Google Photos Web that adds a small floating button on photo pages and opens the current photo's location in AMap.

## What it does

- Runs on `https://photos.google.com/*`.
- Shows a floating "Open in AMap" button when you are viewing an individual photo.
- Finds the visible Google Maps location link that Google Photos exposes for the current photo.
- Extracts WGS84 latitude/longitude from that link and opens an AMap marker page in a new tab.
- Survives Google Photos route changes and basic UI re-renders without needing a page refresh.
- Lets you drag the button to a different spot and double-click it to reset its position.

## Install

Install `open-coord.js` as a userscript in Greasemonkey or a compatible userscript manager:

`https://raw.githubusercontent.com/HankAviator/google-photos-loc-in-amap/master/open-coord.js`

## Updates

The userscript metadata now includes `@updateURL` and `@downloadURL` pointing at the raw GitHub file, so Greasemonkey can detect and download new versions when the script is updated here.
