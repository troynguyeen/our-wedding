/**
 * RSVP endpoint — Thành & Trinh wedding invitation
 * ------------------------------------------------
 * Deploy:  Extensions ▸ Apps Script ▸ paste this file ▸ Deploy ▸ New deployment
 *          Type: Web app │ Execute as: Me │ Who has access: Anyone
 *          Copy the /exec URL into  js/config.js  →  RSVP_ENDPOINT
 *
 * Writes one row per submission to the sheet named by SHEET_NAME and
 * returns JSON. Uses a document lock so concurrent guests cannot
 * interleave writes onto the same row.
 */

var SHEET_NAME = 'RSVP';
var HEADERS = ['Timestamp', 'Name', 'Attending', 'Guests', 'Wishes', 'User Agent'];

function doPost(e) {
  var lock = LockService.getDocumentLock();
  try {
    lock.waitLock(20000);

    var payload = {};
    if (e && e.postData && e.postData.contents) {
      try { payload = JSON.parse(e.postData.contents); }
      catch (err) { payload = (e.parameter || {}); }
    } else {
      payload = (e && e.parameter) || {};
    }

    var name = String(payload.name || '').trim().slice(0, 120);
    if (!name) return json({ ok: false, error: 'MISSING_NAME' });

    var sheet = getSheet_();
    sheet.appendRow([
      new Date(),
      name,
      String(payload.attending || '').slice(0, 60),
      String(payload.guests || '').slice(0, 20),
      String(payload.wishes || '').slice(0, 2000),
      String(payload.ua || '').slice(0, 200)
    ]);

    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (ignored) {}
  }
}

/** Lets you sanity-check the deployment in a browser. */
function doGet() {
  return json({ ok: true, service: 'rsvp', rows: getSheet_().getLastRow() - 1 });
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
