/**
 * Round-trip test for docx editing with the built-in Utilities.unzip / Utilities.zip.
 * Standalone: does not touch the map code. Delete after the zip approach is confirmed.
 *
 * Usage: upload "RE form.docx" to Drive, paste its file ID below, run docxRoundTripTest(),
 * then open the output .docx in Word and confirm:
 *   - it opens without a repair prompt
 *   - "Project:" line reads "ROUNDTRIP TEST PROJECT"
 *   - "No potential to cause effects" is checked and the checkbox still toggles on click
 */
const DOCX_TEST_TEMPLATE_FILE_ID = '1IyhEirWI5XF8V90K1gtvgGGhnlWgSyTb';

function docxRoundTripTest() {
  // unzip only accepts application/zip; retyping the in-memory copy leaves the Drive template untouched.
  const templateBlob = DriveApp.getFileById(DOCX_TEST_TEMPLATE_FILE_ID).getBlob()
    .setContentType('application/zip');
  const parts = Utilities.unzip(templateBlob);
  Logger.log('Template parts (%s):\n%s', parts.length, parts.map(function (p) { return p.getName(); }).join('\n'));

  let found = false;
  parts.forEach(function (part) {
    if (part.getName() !== 'word/document.xml') return;
    found = true;
    let xml = part.getDataAsString('UTF-8');
    xml = docxReplaceText_(xml, 'insert_projname', 'ROUNDTRIP TEST PROJECT');
    xml = docxSetCheckbox_(xml, 'cb_no_potential', true);
    part.setDataFromString(xml, 'UTF-8');
  });
  if (!found) throw new Error('word/document.xml not found in template');

  const outBlob = Utilities.zip(parts, 'RE_form_roundtrip_test.docx');
  outBlob.setContentType('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  const outFile = DriveApp.createFile(outBlob);
  Logger.log('Created: %s', outFile.getUrl());

  // Re-read the output to confirm the edits survived and the part list matches.
  const check = Utilities.unzip(outFile.getBlob().setContentType('application/zip'));
  const checkXml = check.filter(function (p) { return p.getName() === 'word/document.xml'; })[0].getDataAsString('UTF-8');
  Logger.log('Output parts: %s (template had %s)', check.length, parts.length);
  Logger.log('Text replaced: %s', checkXml.indexOf('ROUNDTRIP TEST PROJECT') !== -1);
  Logger.log('Checkbox checked: %s', /cb_no_potential[\s\S]*?<w14:checked w14:val="1"\/>/.test(checkXml));
}

// Replaces a placeholder that sits inside a single w:t element. Logs a warning if absent.
function docxReplaceText_(xml, placeholder, value) {
  if (xml.indexOf(placeholder) === -1) {
    Logger.log('WARNING: placeholder not found (may be split across runs): %s', placeholder);
    return xml;
  }
  return xml.split(placeholder).join(docxEscapeXml_(value));
}

// Sets a w14:checkbox content control (matched by w:tag) to checked/unchecked and updates its glyph.
function docxSetCheckbox_(xml, tag, checked) {
  const tagIdx = xml.indexOf('<w:tag w:val="' + tag + '"/>');
  if (tagIdx === -1) throw new Error('Checkbox tag not found: ' + tag);
  const start = xml.lastIndexOf('<w:sdt>', tagIdx);
  const end = xml.indexOf('</w:sdt>', tagIdx) + '</w:sdt>'.length;
  let sdt = xml.substring(start, end);
  sdt = sdt.replace(/<w14:checked w14:val="[01]"\/>/, '<w14:checked w14:val="' + (checked ? '1' : '0') + '"/>');
  sdt = sdt.replace(/(<w:sdtContent>[\s\S]*?<w:t[^>]*>)[\u2610\u2612](<\/w:t>)/, '$1' + (checked ? '\u2612' : '\u2610') + '$2');
  return xml.substring(0, start) + sdt + xml.substring(end);
}

function docxEscapeXml_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
