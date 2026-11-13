# Playlist Check · TGI Sport

Pagina web che confronta la **playlist Excel** di una partita con il **pacchetto** (`.zip`) generato da quella playlist, e dice se e dove differiscono. Funziona con due sistemi, riconosciuti da soli dal contenuto dei file:

- **Hub**: Excel con il foglio PLAYLIST, oppure con un solo foglio che ha primo e secondo tempo affiancati e una sola colonna *VIRTUAL FEED*, e **AIR package** (`event.hdm`, sequenze `.hdm`, `advertisements/`);
- **Vault**: Excel con un foglio per feed (*Slot · Clock · Time Phase · Time Phase Slot · Duration* e, per ogni zona, *File Name* e *Partner/Shared*) e pacchetto con `project.json`, `playlists/*.json` e `assets/`.

L'Excel comanda: ogni differenza è un errore del pacchetto, salvo i casi in cui l'Excel stesso è incoerente.

L'interfaccia è in inglese britannico; codice, commenti e questo README sono in italiano.

La grafica è quella della Piattaforma TGI Sport: menu laterale (sotto i 1024 px diventa un cassetto aperto da ☰), Montserrat, tema **scuro** predefinito e **chiaro** con l'interruttore *Light mode* / *Dark mode* nel menu e nella pagina di accesso. La scelta resta solo in quel browser (`localStorage`, chiave `tgi-tema`); `app/tema.js` la applica nel `<head>`, prima che la pagina si disegni. I colori sono variabili dei due temi in `app/stile.css`: fuori da quei due blocchi non si scrivono colori (lo controlla `test/stile.test.js`, con il contrasto WCAG).

## Come si usa

1. Aprire il sito e inserire la **password del team** di Playlist Check. Con *Remember on this device* non la chiede più su quel computer; *Sign out* la dimentica.
2. Scheda **Check**: trascinare l'Excel e lo zip della stessa partita (o cliccare sulle due aree). Il controllo parte da solo.
   - **New check** svuota le due aree. Dopo un controllo concluso, anche il primo file caricato apre una coppia nuova: un file nuovo non viene mai confrontato con quello della partita precedente.
   - **Summary**: partita, sistema (Hub o Vault), evento/progetto dello zip, feed e segmenti (fasi nel Vault); avviso se Excel e zip sembrano di partite diverse. Un Excel di un sistema con lo zip dell'altro non si confronta (messaggio).
   - **Banner**: verde *All clear*, giallo *N to confirm*, rosso *N errors*.
   - **To confirm**: nomi quasi uguali (*Possible typo*) o che puntano sempre allo stesso brand sconosciuto (*Possible alias*). *Confirm* li conta come corretti; *Not a typo / Not an alias* come errori. Quando ogni coppia ha una risposta, i refusi confermati partono via mail ai destinatari impostati in Settings e finiscono tra gli alias *in attesa* di Settings. Una conferma vale solo per quel controllo: la coppia viene chiesta di nuovo finché un admin non la rende ufficiale.
   - **Visual check** (facoltativo): *Start visual check* apre prima gli **asset statici** (cerchio di centrocampo, tappeti, zone a sponsor fisso; nel Vault le zone che hanno lo stesso file per tutta la partita): si decidono una volta sola, ognuno con i feed e i segmenti in cui va in onda. Poi la revisione va slot per slot e ogni slot mostra solo quello che cambia, cioè le zone che girano insieme (video muti in loop, immagini ferme), divise in prima e seconda fila (nel Vault per Partner), ognuna con il brand che l'Excel chiede e i pulsanti *Correct* / *Wrong* (con una nota facoltativa). Dietro ogni asset c'è una scacchiera grigia, così si vedono forma e bordi anche di un asset con il fondo nero. Una striscia troppo sottile per il riquadro (es. LED da 11200×90) va a capo su più righe ingrandite, da sinistra a destra: si vede tutta, e ogni riga ricomincia con l'ultimo pezzo della precedente, così nessun logo resta spezzato tra due righe. Gli slot uguali si vedono una volta sola e un gruppo deciso vale in tutti gli slot dove compare. Ogni *Wrong* diventa un **Error** in *Results* e nel report, per ogni feed, ID e zona in cui va in onda; il *Summary* del report dice quanti statici e quanti slot sono stati rivisti. Quando ogni gruppo ha una risposta e sono tutte *Correct* (anche quelle lette in automatico), la scheda *Visual check* diventa verde e il titolo dice *all correct*. Le risposte valgono solo per quel controllo e non vanno nello storico né nelle mail. Un video che il browser non sa aprire (es. codec FFV1) si può salvare con *Save file* e aprire con un altro programma.
   - **Lettura automatica del marchio**: finito il controllo, la pagina legge in sottofondo le scritte nelle animazioni (Tesseract, dentro il browser) e, quando in **tutti** i file di un gruppo legge il marchio che l'Excel chiede, segna il gruppo *Correct* da sola (*read automatically*). Le schermate già decise si saltano, quindi si guarda solo quello che resta; le risposte date a mano valgono sempre e si possono cambiare anche quelle automatiche. Conferma il **marchio**, non la versione (due campagne dello stesso sponsor sono uguali per la lettura). Loghi solo grafici e scritte non latine restano da guardare. Sulle partite di prova legge circa 7 gruppi su 10 nell'Hub e circa la metà nel Vault, in 1–3 minuti a pacchetto (di più se la scheda del browser resta in secondo piano).
   - **Results**: un rigo per gruppo (tipo, feed, segmento, colonna Excel, atteso, trovato) con gli ID; filtri per feed e per tipo.
   - **Name variants**: stesso brand scritto in modo diverso, contato come corretto ed elencato per controllo.
   - **Download report**: Excel con *Summary* e *Findings* (una riga per risultato).
3. Scheda **Statistics**: storico dei controlli (solo numeri), **separato tra Hub e Vault** (selettore *System*; i controlli di prima del Vault sono dell'Hub), filtri per periodo, squadra e partita, *First check per match only*, export in Excel.
   - Se Excel e zip sembrano di due partite diverse (squadre del titolo Excel diverse da quelle dell'evento AIR), il controllo non va nello storico e la mail dei refusi non parte.
4. Scheda **Settings** (visibile a tutti, modifiche con la **password admin**; dopo 5 tentativi sbagliati in 15 minuti bisogna aspettare):
   - **Recipients**: destinatari della mail dei refusi.
   - **Aliases**: le coppie confermate nei controlli (*Waiting for approval*); *Make official* le fa contare come corrette in ogni controllo successivo, per tutti, senza ripubblicare il sito; *Dismiss* e *Remove* le tolgono. In fondo, l'elenco degli alias cifrati nelle regole.

## Privacy

- I due file si leggono **solo nel browser**: non vengono mai caricati su un server. Anche i video e le immagini del *Visual check* si aprono dallo zip già caricato, dentro la pagina, e la lettura automatica del marchio gira in un worker della pagina con i file di `lib/tesseract/` (nessun CDN).
- Allo script Google arrivano solo i **numeri** del controllo (celle, errori, refusi…) e, per i refusi/alias confermati, partita, feed, segmento, ID, colonna e i due nomi. Gli alias approvati in Settings stanno nel foglio Google (tab *Aliases*).
- La pagina ha una Content-Security-Policy: carica solo i propri file (più i media del *Visual check*, creati nel browser come `blob:`, e il worker della lettura automatica dal sito stesso) e si collega solo allo script Google.
- Le regole delicate (alias ufficiali, zone a regola fissa, indirizzo e codice dello script) sono **cifrate** con la password del team (AES-256-GCM, chiave PBKDF2-SHA256 con 600.000 iterazioni) in `regole/regole.js`.

## Cosa si controlla

- **Virtual**: per ogni feed, slot e fila, il brand dell'Excel contro gli artwork dello zip. La fila di un artwork si ricava dal suffisso (`_1`/`_J` prima fila, `_2` seconda) del nome advertiser, poi dell'ad, poi del file. Quando l'Excel ha un brand, **ogni zona LED in uso** di quella fila deve mostrarlo, non solo alcune. La fila di una zona è quella scritta nel nome (`_1`/`_2`), altrimenti quella dei file che ospita (es. TL_A di seconda fila); le zone mai usate nel pacchetto (es. angoli non in uso) non contano.
- **Durate** di ogni slot (colonna C) e slot contigui. Ogni **video** (mp4/mov) deve stare nel suo slot: lo slot dura un numero intero di volte il video (un 15" in uno slot da 30 gira due volte e va bene; un 15" in uno slot da 10, o un 10" in uno da 15, è un errore). La durata si legge dal file vero, quindi vale anche quando i nomi delle versioni da 10" e da 15" coincidono.
- **Artwork di un'altra zona**: ogni artwork deve essere fatto per la zona che lo ospita, anche quando il brand è giusto (es. la versione GL sulla Jumbo). Il formato in pixel si legge dal file vero e si confronta con quello abituale della zona, cioè il più usato nel pacchetto: è un errore un artwork alto più del 25% di scarto (90 px contro 180) o con il formato abituale di un'altra zona (zone alte uguali, es. GL e TL). Le piccole differenze di larghezza dentro una zona sono normali.
- **Asset statici** in ogni slot dei tre segmenti: centro campo (solo nel secondo slot del pre-match), CLUB MAT, zone a regola fissa (sponsor diverso per Domestico, Far East e altri feed), ADDITIONAL (anche su RSX/RDX), LOWER CORNER.
- **Pacchetto**: file media e sequenze presenti, feed presenti per le regioni con contenuto. Un segmento con un nome che non si riconosce non viene controllato (avviso).
- **Excel**: il foglio highlights è quello che si chiama HL/HIGHLIGHT, altrimenti il primo rimasto con la colonna ID; una riga con un ID non numerico resta al suo posto, con un avviso.
- **Excel a foglio unico** (primo e secondo tempo affiancati, riconosciuto dal contenuto del primo foglio; degli altri fogli conta solo *STATIC ASSETS*, se c'è): la colonna *VIRTUAL FEED* (o un'altra colonna con *FEED* nel nome, es. *AWAY NATIONAL FEED PITCH*) vale per ogni feed del pacchetto e si confronta con le zone LED laterali; se c'è una colonna *2\* ROW* (o *2ND ROW*), dà il brand della seconda fila. Gli highlights non sono richiesti. Una cella `CB: <brand>` dice il brand della zona CENTREBOARD (o CENTERBOARD) per tutta la partita (senza la nota la zona non si controlla). Il foglio *STATIC ASSETS*, con le colonne *FIRST HALF* e *SECOND HALF*, dà il brand di ogni tappeto tempo per tempo: la riga *CLUB MAT L1* vale per la zona Mats_L1 (o Mats L1), *CLUB MAT R1* per Mats_R1 (un tappeto senza la sua riga non si controlla e dà un avviso). Centreboard e tappeti nel visual check compaiono tra gli asset statici; le zone GRASS_ sono texture del prato e non si controllano. Una riga *LOOP* nella colonna dei brand, anche senza ID, chiude la playlist (le righe sotto non contano): dagli slot dopo l'ultima riga il pacchetto ripete la playlist da capo, dalla seconda riga se l'ultima è uguale alla prima, altrimenti dalla prima. Questi slot si controllano come le altre righe, con la colonna *… · loop of ID n*. Senza riga LOOP, dopo l'ultima riga compilata, anche oltre le righe dell'Excel, gli slot che ripetono in alternanza le ultime due righe sono *Recovery*; un altro brand è un **Error**, con il brand che il recupero doveva ripetere (così un alias si riconosce anche lì). L'ultimo intervallo di ogni tempo, se nel pacchetto è del tutto vuoto, non ha statici da controllare.
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
| `app/` | moduli: lettura Excel e AIR (Hub), lettura e confronto Vault, video, confronto, report, visual check (`revisione.js` schermate e risposte, `revisione-ui.js` pannello, `lettura-automatica.js` parola da cercare e risposte automatiche, `lettura-automatica-ui.js` lettura nel browser), cifratura, accesso, menu e tema (`app.js`, `tema.js`), stile (`stile.css`), carattere Montserrat (`font/`, licenza OFL) |
| `lib/` | JSZip 3.10.1, SheetJS 0.20.3 e `tesseract/` (tesseract.js 7.0.0, dati inglesi tessdata_fast; origine e licenza in `lib/tesseract/ORIGINE.txt`), copiati, nessun CDN |
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
