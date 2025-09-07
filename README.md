# librus-api

[![npm](https://img.shields.io/npm/v/librus-api.svg?style=flat)](https://www.npmjs.com/package/librus-api)  
[![License](https://img.shields.io/badge/license-MIT-green.svg?style=flat)](http://opensource.org/licenses/MIT)

Otwartoźródłowy klient HTTP do parsowania odpowiedzi HTML serwera dziennika elektronicznego **Librus / Synergia**.  
Nie jest to oficjalny produkt Synergia.

---

## Instalacja

```bash
npm install librus-api
```

---

## Szybki start

```javascript
const Librus = require("librus-api");
const fs = require("fs");

const client = new Librus();

client.authorize("login", "pass").then(() => {
  // Wyslij wiadomosc
  client.inbox.sendMessage(648158, "tytul", "tresc");

  // Pobierz wszystkie przedmioty
  client.homework.listSubjects().then(console.log);

  // Pobierz oceny
  client.info.getGrades().then(console.log);
});
```

---

## Funkcje

### Inbox
- `sendMessage(userId, title, body)` – wysyłanie wiadomości  
- `removeMessage(messageId)` – usuwanie wiadomości  
- `listReceivers(query)` – lista odbiorców  
- `listAnnouncements()` – ogłoszenia  
- `listInbox(folderId, page?)` – lista e-maili  
- `getMessage(folderId, messageId)` – pobranie wiadomości wraz z załącznikami

### Homework
- `listSubjects()` – lista przedmiotów  
- `listHomework(subjectId)` – lista prac domowych  
- `getHomework(homeworkId)` – szczegóły pracy domowej

### Absence
- `getAbsences()` – wszystkie nieobecności  
- `getAbsence(absenceId)` – szczegóły nieobecności

### Calendar
- `getTimetable()` – plan lekcji  
- `getCalendar()` – kalendarz  
- `getEvent(eventId)` – szczegóły wydarzenia

### Info
- `getGrades()` – wszystkie oceny  
- `getGrade(gradeId)` – szczegóły oceny  
- `getPointGrade(pointGradeId)` – ocena punktowa  
- `getAccountInfo()` – dane konta  
- `getLuckyNumber()` – szczęśliwy numer  
- `getNotifications()` – powiadomienia

---

## Licencja

MIT © 2025 Mateusz Bagiński  
[Pełny tekst licencji](http://opensource.org/licenses/MIT)
