# Playlist Check · TGI Sport

Pagina web che confronta la **playlist Excel** di una partita con l'**AIR package** (`.zip`) generato da quella playlist, e dice se e dove differiscono. L'Excel comanda: ogni differenza è un errore dello zip, salvo i casi in cui l'Excel stesso è incoerente.

L'interfaccia è in inglese britannico; codice, commenti e questo README sono in italiano.

## Come si usa

1. Aprire il sito e inserire la **password del team** di Playlist Check. Con *Remember on this device* non la chiede più su quel computer; *Sign out* la dimentica.
2. Scheda **Check**: trascinare l'Excel e lo zip della stessa partita (o cliccare sulle due aree). Il controllo parte da solo.
   - **Summary**: partita, evento dello zip, feed e segmenti trovati; avviso se Excel e zip sembrano di partite diverse.
   - **Banner**: verde *All clear*, giallo *N to confirm*, rosso *N errors*.
   - **To confirm**: nomi quasi uguali (*Possible typo*) o che puntano sempre allo stesso brand sconosciuto (*Possible alias*). *Confirm* li conta come corretti; *Not a typo / Not an alias* come errori. Quando ogni coppia ha una risposta, i refusi confermati partono via mail ai destinatari impostati in Settings.
   - **Results**: un rigo per gruppo (tipo, feed, segmento, colonna Excel, atteso, trovato) con gli ID; filtri per feed e per tipo.
   - **Name variants**: stesso brand scritto in modo diverso, contato come corretto ed elencato per controllo.
   - **Download report**: Excel con *Summary* e *Findings* (una riga per risultato).
3. Scheda **Statistics**: storico dei controlli (solo numeri), filtri per periodo, squadra e partita, *First check per match only*, export in Excel.
4. Scheda **Settings**: destinatari della mail dei refusi; per modificarli serve la **password admin**.

## Privacy

- I due file si leggono **solo nel browser**: non vengono mai caricati su un server.
- Allo script Google arrivano solo i **numeri** del controllo (celle, errori, refusi…) e, per i refusi/alias confermati, partita, feed, segmento, ID, colonna e i due nomi.
- Le regole delicate (alias ufficiali, zone a regola fissa, indirizzo e codice dello script) sono **cifrate** con la password del team (AES-256-GCM, chiave PBKDF2-SHA256 con 600.000 iterazioni) in `regole/regole.js`.

## Cosa si controlla

- **Virtual**: per ogni feed, slot e fila, il brand dell'Excel contro gli artwork dello zip. La fila di un artwork si ricava dal suffisso (`_1`/`_J` prima fila, `_2` seconda) del nome advertiser, poi dell'ad, poi del file.
- **Durate** di ogni slot (colonna C) e slot contigui.
- **Asset statici** in ogni slot dei tre segmenti: centro campo (solo nel secondo slot del pre-match), CLUB MAT, zone a regola fissa (sponsor diverso per Domestico, Far East e altri feed), ADDITIONAL (anche su RSX/RDX), LOWER CORNER.
- **Pacchetto**: file media e sequenze presenti, feed presenti per le regioni con contenuto.
- **Minuti di recupero**: dopo l'ultima riga piena dell'Excel lo zip può ripetere lo stesso brand fino all'ultimo slot (*Recovery*, avviso).

Le righe Excel si abbinano agli slot **per posizione** (lo slot 0 delle partite è il lead-in), non per numero di ID.

## Aggiornare le regole (alias ufficiali)

Le regole in chiaro stanno solo in locale (`regole-sorgente/regole.json`, mai pubblicato). Dopo una modifica:

```bash
node strumenti/cifra-regole.mjs regole-sorgente/password.txt regole-sorgente/regole.json regole/regole.js --nuova
```

La password del team sta solo in locale in `regole-sorgente/password.txt` (prima riga che non inizia con `#`); lo strumento non la stampa mai. Per cambiarla basta scrivere la nuova nel file e rilanciare il comando. Poi si aumenta il numero `?v=` dei file in `index.html` e si pubblica.

## Struttura

| Percorso | Contenuto |
|---|---|
| `index.html` | pagina unica (Check / Statistics / Settings) |
| `app/` | moduli: lettura Excel e AIR, confronto, report, cifratura, accesso, schede |
| `lib/` | JSZip 3.10.1 e SheetJS 0.20.3 (copiati, nessun CDN) |
| `regole/regole.js` | regole cifrate |
| `backend/` | script Google (`Codice.gs`, `appsscript.json`) |
| `test/` | prove automatiche |

I moduli del motore funzionano sia nel browser (`PC.<nome>`) sia in Node (`require`).

## Prove

```bash
node --test 'test/*.test.js'
```

Con le coppie reali in locale (cartella con una sottocartella per squadra, e i risultati di riferimento del prototipo in `test/dati-locali/`):

```bash
PC_COPPIE=~/Desktop/VerificaPlaylist node --test 'test/*.test.js'
```
