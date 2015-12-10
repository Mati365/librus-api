# librus-api
Simple node.js Librus scraping API module

## Installation:
```
npm install librus-api
```

## Usage
**Login and list mails in folder**
```javascript
'use strict';
const Librus = require("./api/core.js");

let client = new Librus();
client.authorize("login", "pass").then(function () {
  // Send message to User 648158 
  client.inbox.sendMessage(648158, "title", "body").then(() => { /** sucess */ }, () => { /** fail **/ });
  
  // Remove message with id 4534535
  client.inbox.removeMessage(4534535).then(() => { /** sucess */ }, () => { /** fail **/ });
  
  // List receivers
  client.inbox.listReceivers("nauczyciel").then(data => {});
  
  // List announcements
  client.inbox.listAnnouncements().then(data => {});
  
  // List all e-mails in folder(6) in page(2)
  client.inbox.listInbox(6, 2).then(data => {});
  
  // List all subjects
  client.homework.listSubjects().then(data => {});
  
  // List subject homeworks, -1||undefined all
  client.homework.listHomeworks(24374).then(list => {});
  
  // Download homework description
  client.homework.getHomework(257478).then(data => {});
  
  // Get message with id 2133726 in folder 6
  client.inbox.getMessage(6, 2133726).then(data => {});
  
  // Get all absences
  client.absence.getAbsences().then(data => {});
  
  // Get info about absence
  client.absence.getAbsence(5068489).then(data => {});
});

```
