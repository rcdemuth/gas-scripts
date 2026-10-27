function gmailAutoarchive() { //Variable function for multiple labels with different time periods to keep emails in inbox before auto-archiving
  var rules = { // Each label with number of days to keep
    "automatic-archiving-autoarchive" : 7,
    "Announcements" : 4,
    "automatic-archiving-insta-archive" : 0,
    "automatic-archiving-quickarchive" : 1,
    "appscripts": 1
  }
  var batch_size = 100;
  for (let label in rules) { 
    var keepdays = rules[label];
    Logger.log(`Archiving all threads in ${label} older than ${keepdays} Days`);
    var threads = GmailApp.search(`label:inbox label:${label} older_than:${keepdays}d -is:starred -is:important`);
    Logger.log(`Identified ${threads.length.toString()} threads for archival in ${label}`);
    while (threads.length) {
      var this_batch_size = Math.min(threads.length, batch_size);
      var this_batch = threads.splice(0, this_batch_size);
      GmailApp.markThreadsRead(this_batch);
      GmailApp.moveThreadsToArchive(this_batch);
    }
  }
}
