  function onEdit(e) {
  const sheet = e.range.getSheet();
  if (e.range.getA1Notation() === 'C4') {
    if (e.value === 'Single String') {
      sheet.showRows(5,2);
      sheet.showRows(10);
      sheet.hideRows(8,2);
      sheet.hideRows(11);
    }
    if (e.value === 'Coordinates') {
      sheet.showRows(8,1);
      sheet.showRows(9,1);
      sheet.hideRows(5,2);
      sheet.hideRows(10);
      sheet.hiderows(11,-2);

    }
 }
  if (e.range.getA1Notation() === 'C18') {
    if (e.value === 'String Input') {
      sheet.showRows(19);
      sheet.hideRows(20,2);

    }
    if (e.value === 'Individual Components') {
      sheet.showRows(20,2);
      sheet.hideRows(19);
    }
 }


}
