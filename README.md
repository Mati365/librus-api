# librus-api

[![npm](https://img.shields.io/npm/v/librus-api.svg?style=flat)](https://www.npmjs.com/package/librus-api)
[![License](https://img.shields.io/badge/license-MIT-green.svg?style=flat)](http://opensource.org/licenses/MIT)

Otwartoźródłowy klient HTTP parsujący odpowiedzi HTML serwera dziennika elektronicznego Librus / Synergia.

**⚠️ WAŻNE OSTRZEŻENIE**

- Ta biblioteka **nie jest oficjalnym produktem** firmy Librus / Synergia i nie jest z nimi powiązana w żaden sposób.
- Jest to nieoficjalny, reverse-engineered klient HTTP działający jak zwykła przeglądarka.
- Korzystanie z niej może być niezgodne z [Regulaminem Synergia](https://synergia.librus.pl/regulamin) (w szczególności zakazem systematycznego pobierania danych).
- Biblioteka jest przeznaczona **wyłącznie do użytku prywatnego i edukacyjnego** przez pojedynczego użytkownika na swoim koncie.
- **Nie używaj jej do automatycznego scrapingu na dużą skalę**, botów, monitoringu klasowego ani komercyjnie.
- Autor nie ponosi żadnej odpowiedzialności za zablokowanie konta, utratę danych ani jakiekolwiek konsekwencje.
- Używaj na własne ryzyko i z poszanowaniem limitów serwerów Librusa.

## Instalacja

```sh
npm install librus-api
```

## Usage

```ts
import { LibrusClient } from "librus-api";

const client = new LibrusClient("login", "password");

const account = await client.info.getAccountInfo();
const lucky = await client.info.getLuckyNumber();
```

## Licencja

The MIT License (MIT)

Copyright (c) 2025 Mateusz Bagiński
Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
