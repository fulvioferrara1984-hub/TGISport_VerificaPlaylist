# Playlist Check · TGI Sport

Pagina web che confronta la **playlist Excel** di una partita con il **pacchetto** (`.zip`) generato da quella playlist, e dice se e dove differiscono. Funziona con due sistemi, riconosciuti da soli dal contenuto dei file:

- **Hub**: Excel con il foglio PLAYLIST e **AIR package** (`event.hdm`, sequenze `.hdm`, `advertisements/`);
- **Vault**: Excel con un foglio per feed (*Slot · Clock · Time Phase · Time Phase Slot · Duration* e, per ogni zona, *File Name* e *Partner/Shared*) e pacchetto con `project.json`, `playlists/*.json` e `assets/`.

L'Excel comanda: ogni differenza è un errore del pacchetto, salvo i casi in cui l'Excel stesso è incoerente.

L'interfaccia è in inglese britannico; codice, commenti e questo README sono in italiano.

## Come si usa

1. Aprire il sito e inserire la **password del team** di Playlist Check. Con *Remember on this device* non la chiede più su quel computer; *Sign out* la dimentica.
2. Scheda **Check**: trascinare l'Excel e lo zip della stessa partita (o cliccare sulle due aree). Il controllo parte da solo.
   - **New check** svuota le due aree. Dopo un controllo concluso, anche il primo file caricato apre una coppia nuova: un file nuovo non viene mai confrontato con quello della partita precedente.
   - **Summary**: partita, sistema (Hub o Vault), evento/progetto dello zip, feed e segmenti (fasi nel Vault); avviso se Excel e zip sembrano di partite diverse. Un Excel di un sistema con lo zip dell'altro non si confronta (messaggio).
   - **Banner**: verde *All clear*, giallo *N to confirm*, rosso *N errors*.
   - **To confirm**: nomi quasi uguali (*Possible typo*) o che puntano sempre allo stesso brand sconosciuto (*Possible alias*). *Confirm* li conta come corretti; *Not a typo / Not an alias* come errori. Quando ogni coppia ha una risposta, i refusi confermati partono via mail ai destinatari impostati in Settings e finiscono tra gli alias *in attesa* di Settings. Una conferma vale solo per quel controllo: la coppia viene chiesta di nuovo finché un admin non la rende ufficiale.
   - **Results**: un rigo per gruppo (tipo, feed, segmento, colonna Excel, atteso, trovato) con gli ID; filtri per feed e per tipo.
   - **Name variants**: stesso brand scritto in modo diverso, contato come corretto ed elencato per controllo.
   - **Download report**: Excel con *Summary* e *Findings* (una riga per risultato).
3. Scheda **Statistics**: storico dei controlli (solo numeri), **separato tra Hub e Vault** (selettore *System*; i controlli di prima del Vault sono dell'Hub), filtri per periodo, squadra e partita, *First check per match only*, export in Excel.
   - Se Excel e zip sembrano di due partite diverse (squadre del titolo Excel diverse da quelle dell'evento AIR), il controllo non va nello storico e la mail dei refusi non parte.
4. Scheda **Settings** (visibile a tutti, modifiche con la **password admin**; dopo 5 tentativi sbagliati in 15 minuti bisogna aspettare):
   - **Recipients**: destinatari della mail dei refusi.
   - **Aliases**: le coppie confermate nei controlli (*Waiting for approval*); *Make official* le fa contare come corrette in ogni controllo successivo, per tutti, senza ripubblicare il sito; *Dismiss* e *Remove* le tolgono. In fondo, l'elenco degli alias cifrati nelle regole.

## Privacy

- I due file si leggono **solo nel browser**: non vengono mai caricati su un server.
- Allo script Google arrivano solo i **numeri** del controllo (celle, errori, refusi…) e, per i refusi/alias confermati, partita, feed, segmento, ID, colonna e i due nomi. Gli alias approvati in Settings stanno nel foglio Google (tab *Aliases*).
- La pagina ha una Content-Security-Policy: carica solo i propri file e si collega solo allo script Google.
- Le regole delicate (alias ufficiali, zone a regola fissa, indirizzo e codice dello script) sono **cifrate** con la password del team (AES-256-GCM, chiave PBKDF2-SHA256 con 600.000 iterazioni) in `regole/regole.js`.

## Cosa si controlla

- **Virtual**: per ogni feed, slot e fila, il brand dell'Excel contro gli artwork dello zip. La fila di un artwork si ricava dal suffisso (`_1`/`_J` prima fila, `_2` seconda) del nome advertiser, poi dell'ad, poi del file. Quando l'Excel ha un brand, **ogni zona LED in uso** di quella fila deve mostrarlo, non solo alcune. La fila di una zona è quella scritta nel nome (`_1`/`_2`), altrimenti quella dei file che ospita (es. TL_A di seconda fila); le zone mai usate nel pacchetto (es. angoli non in uso) non contano.
- **Durate** di ogni slot (colonna C) e slot contigui. Ogni **video** (mp4/mov) deve stare nel suo slot: lo slot dura un numero intero di volte il video (un 15" in uno slot da 30 gira due volte e va bene; un 15" in uno slot da 10, o un 10" in uno da 15, è un errore). La durata si legge dal file vero, quindi vale anche quando i nomi delle versioni da 10" e da 15" coincidono.
- **Asset statici** in ogni slot dei tre segmenti: centro campo (solo nel secondo slot del pre-match), CLUB MAT, zone a regola fissa (sponsor diverso per Domestico, Far East e altri feed), ADDITIONAL (anche su RSX/RDX), LOWER CORNER.
- **Pacchetto**: file media e sequenze presenti, feed presenti per le regioni con contenuto. Un segmento con un nome che non si riconosce non viene controllato (avviso).
- **Excel**: il foglio highlights è quello che si chiama HL/HIGHLIGHT, altrimenti il primo rimasto con la colonna ID; una riga con un ID non numerico resta al suo posto, con un avviso.
- **Nomi**: un nome vale come variante solo a confini di parola (parole intere, parole che insieme ne compongono una, o abbreviazioni di almeno 4 lettere e il 60% della parola).
- **Minuti di recupero**: dopo l'ultima riga piena dell'Excel lo zip può ripetere lo stesso brand fino all'ultimo slot (*Recovery*, avviso).

Le righe Excel si abbinano agli slot **per posizione** (lo slot 0 delle partite è il lead-in), non per numero di ID.

### Vault

- Ogni foglio dell'Excel con l'intestazione Vault è un **feed**, abbinato allo stream del pacchetto con lo stesso nome; un foglio o uno stream senza l'altro è un errore.
- La riga *Time Phase* + *Time Phase Slot* n va con l'n-esimo intervallo della playlist di quella fase; nei risultati l'ID è **fase e slot** (es. 1st Half, 5).
- Per ogni zona (Left, Center, Right… il Center come le altre) il **nome del file** deve essere quello dell'Excel; *Not Applicable* vuol dire nessun asset. Un **partner** diverso dal publisher dell'asset è un avviso.
- Durata di ogni slot (colonna Duration), slot contigui, asset presenti in `assets/`, video che stanno nel loro slot (i `.mov` del Vault sono frammentati: durata e fotogrammi al secondo si leggono dai frammenti).
- **Variante del pacchetto**: se lo zip ha fasi che l'Excel non descrive (es. Half-time, Post-match), quelle fasi, il pre-match *Not Applicable* con contenuti, gli slot in più e l'ultimo slot di una fase con un'altra durata sono **avvisi** (*package variant*), non errori.

## Aggiornare le regole cifrate (alias di base, zone a regola fissa, script)

Gli alias nuovi si approvano da Settings → Aliases, senza toccare le regole cifrate. Le regole cifrate servono per gli alias di base e per il resto della configurazione.

Le regole in chiaro stanno solo in locale (`regole-sorgente/regole.json`, mai pubblicato). Dopo una modifica:

```bash
node strumenti/cifra-regole.mjs regole-sorgente/password.txt regole-sorgente/regole.json regole/regole.js --nuova
```

La password del team sta solo in locale in `regole-sorgente/password.txt` (prima riga che non inizia con `#`); lo strumento non la stampa mai. Per cambiarla basta scrivere la nuova nel file e rilanciare il comando. Poi si aumenta il numero `?v=` dei file in `index.html` e si pubblica.

## Struttura

| Percorso | Contenuto |
|---|---|
| `index.html` | pagina unica (Check / Statistics / Settings) |
| `app/` | moduli: lettura Excel e AIR (Hub), lettura e confronto Vault, video, confronto, report, cifratura, accesso, schede |
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

Per le coppie reali del Vault: `PC_VAULT=<cartella con una sottocartella per partita>` e i risultati di riferimento in `test/dati-locali/attesi-vault.json`.
