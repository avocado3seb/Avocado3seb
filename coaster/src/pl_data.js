// Daten für den Phantasialand-Modus: zusätzliche Zonen, Gastronomie, Shops, Hotels, Shows, Attraktionen, Erfolge.
// WICHTIG: Namen der Gastronomie/Shops, Speisekarten, Preise, Zimmertypen und Showzeiten sind FREI ERGÄNZT (Beispielangebot)
// und keine echten Angaben des Parks. Echt sind nur die Bahn-/Hotel-/Themenbereichsnamen aus der Aufgabenstellung.

export const EXTRA_ZONES = {
  china:   { name: 'China Town', x: -190, z: -235, r: 130, tint: [0.34, 0.44, 0.26], fog: 1.2, fogCol: [0.7, 0.62, 0.62], amb: 1, desc: 'Pagoden, Gärten, Laternen und Brücken – Feng Ju Palace, Hotel Ling Bao' },
  mystery: { name: 'Mystery', x: 215, z: -245, r: 130, tint: [0.24, 0.28, 0.3], fog: 2.4, fogCol: [0.34, 0.38, 0.44], amb: 0.7, desc: 'Düsteres Schloss, Nebel und ein wilder Fluss – Mystery Castle, River Quest' },
  parking: { name: 'Parkplatz', x: 0, z: 520, r: 120, tint: [0.34, 0.34, 0.34], fog: 1, fogCol: [0.7, 0.75, 0.8], amb: 1, desc: 'Parkplatz und Anreise' },
};

// Attraktionen ohne bekannte Echtdaten: als stilisierte Fahrten mit der Streckenengine umgesetzt
export const ATTRACTIONS = [
  ['Chiapas', 'water', 'Mexico', 'ST LIFT:14:30:2.4 DROP:14:40 TR:180:22:30 HILL:3:40 HOME:22:30', '#2a8a8a', 'Wasserfahrt (stilisiert)'],
  ['River Quest', 'water', 'Mystery', 'ST DRV:3 S:20 TR:90:25:20 TL:90:25:20 TR:180:28:25 HOME:28:25', '#3a6a9a', 'Wildwasserfahrt (stilisiert)'],
  ['Mystery Castle', 'family', 'Mystery', 'ST LIFT:30:70:3 DROP:30:78 TR:180:18:30 HILL:3:40 HOME:18:30', '#6a5a7a', 'Turm-Fahrt (stilisiert)'],
  ['Talocan', 'family', 'Mexico', 'ST LIFT:24:65:3 DROP:24:75 TR:180:16:30 HILL:3:40 HOME:16:30', '#c8802a', 'Turm-Fahrt (stilisiert)'],
  ['Maus au Chocolat', 'darkride', 'Berlin', 'ST DRV:2.2 S:12 TR:90:12:15 TL:90:12:15 TR:90:12:15 TL:90:12:15 TR:180:14:15 HOME:14:20', '#8a5a3a', 'Darkride (stilisiert)'],
  ['Wakobato', 'family', 'Fantasy', 'ST LIFT:10:25:2.2 DROP:10:35 TR:180:16:35 HILL:3:40 HOME:16:30', '#d870b8', 'Familienfahrt (stilisiert)'],
  ['Geister Rikscha', 'darkride', 'China Town', 'ST DRV:2.2 S:14 TR:90:12:15 TL:90:12:15 TR:90:12:15 TL:90:12:15 TR:180:14:15 HOME:14:20', '#6a8a6a', 'Darkride (stilisiert)'],
  ['Hollywood Tour', 'darkride', 'Berlin', 'ST DRV:2.4 S:16 TL:90:14:15 TR:90:14:15 TL:90:14:15 TR:90:14:15 TR:180:16:15 HOME:16:20', '#c8a030', 'Darkride (stilisiert)'],
  ['Feng Ju Palace', 'darkride', 'China Town', 'ST DRV:2.2 S:12 TR:90:12:15 TL:90:12:15 TR:90:12:15 TL:90:12:15 TR:180:14:15 HOME:14:20', '#c8202e', 'Darkride (stilisiert)'],
  ['Das verrückte Hotel Tartüff', 'darkride', 'Berlin', 'ST DRV:2.2 S:10 TL:90:10:15 TR:90:10:15 TL:90:10:15 TR:90:10:15 TL:180:12:15 HOME:12:20', '#b8485a', 'Darkride im schiefen Hotel (stilisiert)'],
  ['Die 3 Mausketiere', 'family', 'Berlin', 'ST LIFT:9:25:2.2 DROP:9:34 TR:90:14:35 HILL:3:40 TL:90:14:35 TR:180:15:35 HOME:15:30', '#d8a030', 'Familienfahrt (stilisiert)'],
  ['Tikal', 'family', 'Mexico', 'ST LIFT:10:27:2.4 DROP:10:37 TR:90:15:38 HILL:3:44 TL:90:15:38 TR:180:16:38 HOME:16:33', '#c8802a', 'Familienfahrt am Maya-Tempel (stilisiert)'],
  ['Würmling Express', 'kids', 'Wuze Town', 'ST LIFT:7:22:2 DROP:7:30 TR:90:12:30 HILL:2:34 TL:90:12:30 HILL:2:30 TR:180:13:30 HOME:13:26', '#6ac84a', 'Kinder-/Familienbahn in Wuze Town (stilisiert)'],
];

export const ZONE_OF_AREA = { 'Klugheim': 'klugheim', 'Deep in Africa': 'africa', 'Rookburgh': 'rookburgh', 'Mexico': 'mexico', 'Fantasy': 'fantasy', 'China Town': 'china', 'Mystery': 'mystery', 'Berlin': 'berlin', 'Wuze Town': 'fantasy' };

// kind: restaurant | stand | shop | hotel | stage | wc | gate
export const POIS = [
  // Hotels (Namen echt; Zimmertypen/Preise frei ergänzt)
  { id: 'h-lind', kind: 'hotel', name: 'Hotel Charles Lindbergh', zone: 'rookburgh', rooms: [['Doppelzimmer', 189], ['Familienzimmer', 239], ['Suite', 329]] },
  { id: 'h-mat', kind: 'hotel', name: 'Hotel Matamba', zone: 'africa', rooms: [['Doppelzimmer', 179], ['Familienzimmer', 229], ['Suite', 319]] },
  { id: 'h-ling', kind: 'hotel', name: 'Hotel Ling Bao', zone: 'china', at: [-188, -96], rooms: [['Doppelzimmer', 169], ['Familienzimmer', 219], ['Suite', 299]] },
  // Gastronomie
  { id: 'r-klug', kind: 'restaurant', name: "Rutmor's Taverne", zone: 'klugheim', menu: [['Eintopf im Brotlaib', 9.5], ['Wildschwein-Burger', 12.9], ['Kartoffelspalten', 5.5], ['Honigmet (alkoholfrei)', 4.2], ['Apfelkuchen', 5.9]] },
  { id: 's-klug1', kind: 'stand', name: 'Feuerstelle (Snacks)', zone: 'klugheim', menu: [['Stockbrot', 4.5], ['Bratwurst im Brötchen', 6.5], ['Glühwein-Saft', 4.0]] },
  { id: 'r-afr', kind: 'restaurant', name: 'Lodge-Restaurant', zone: 'africa', menu: [['Gemüsecurry', 11.9], ['Hähnchen-Spieß', 13.5], ['Bananen-Pfannkuchen', 6.9], ['Mango-Lassi', 4.9], ['Eistee', 3.8]] },
  { id: 's-afr1', kind: 'stand', name: 'Dschungel-Bar', zone: 'africa', menu: [['Fruchtcocktail (alkoholfrei)', 6.5], ['Kokosnuss-Wasser', 4.5], ['Mais-Snack', 4.2]] },
  { id: 'r-rook', kind: 'restaurant', name: 'Maschinenhalle (Restaurant)', zone: 'rookburgh', menu: [['Pasta Aeronaut', 10.9], ['Pizza Propeller', 11.5], ['Flammkuchen', 9.9], ['Cola', 3.9], ['Kaffee', 3.5], ['Schokokuchen', 5.5]] },
  { id: 's-rook1', kind: 'stand', name: 'Dampf-Imbiss', zone: 'rookburgh', menu: [['Pommes', 4.5], ['Currywurst', 6.9], ['Popcorn', 4.0]] },
  { id: 'r-mex', kind: 'restaurant', name: 'Cantina', zone: 'mexico', menu: [['Burrito', 10.5], ['Nachos mit Käse', 8.5], ['Quesadilla', 9.5], ['Limonade', 3.9]] },
  { id: 's-mex1', kind: 'stand', name: 'Churro-Wagen', zone: 'mexico', menu: [['Churros', 5.0], ['Eis am Stiel', 3.5], ['Fruchtbecher', 4.5]] },
  { id: 'r-chi', kind: 'restaurant', name: 'Teehaus & Nudelküche', zone: 'china', menu: [['Gebratene Nudeln', 10.9], ['Frühlingsrollen', 6.5], ['Bubble Tea', 5.5], ['Jasmin-Tee', 3.2]] },
  { id: 's-fan1', kind: 'stand', name: 'Märchen-Waffeln', zone: 'fantasy', menu: [['Waffel mit Kirschen', 5.5], ['Zuckerwatte', 4.0], ['Eis-Kugel', 2.2]] },
  { id: 'r-ber', kind: 'restaurant', name: 'Café am Kaiserplatz', zone: 'berlin', menu: [['Kaffee', 3.5], ['Kuchen des Tages', 4.9], ['Currywurst Pommes', 8.9], ['Schnitzel-Brötchen', 7.9], ['Limonade', 3.5]] },
  { id: 's-ber1', kind: 'stand', name: 'Burger-Wagen', zone: 'berlin', menu: [['Cheeseburger', 7.5], ['Pommes', 4.5], ['Softdrink', 3.5]] },
  { id: 's-mys1', kind: 'stand', name: 'Nebel-Kiosk', zone: 'mystery', menu: [['Heiße Schokolade', 4.5], ['Popcorn', 4.0], ['Brezel', 3.5]] },
  // Shops
  { id: 'sh-klug', kind: 'shop', name: 'Felsen-Souvenirs', zone: 'klugheim', menu: [['Plüsch-Drache', 19.9], ['Schlüsselanhänger', 6.9], ['T-Shirt', 24.9], ['Kappe', 16.9]] },
  { id: 'sh-afr', kind: 'shop', name: 'Safari-Laden', zone: 'africa', menu: [['Plüsch-Schlange', 17.9], ['Holzfigur', 14.9], ['T-Shirt', 24.9], ['Strohhut', 18.5]] },
  { id: 'sh-rook', kind: 'shop', name: 'Aeronauten-Shop', zone: 'rookburgh', menu: [['Fliegerbrille', 12.9], ['Modell-Zeppelin', 21.9], ['T-Shirt', 24.9], ['Schlüsselanhänger', 6.9]] },
  { id: 'sh-mex', kind: 'shop', name: 'Mercado', zone: 'mexico', menu: [['Sombrero', 15.9], ['Maracas', 9.9], ['T-Shirt', 24.9]] },
  { id: 'sh-fan', kind: 'shop', name: 'Märchen-Laden', zone: 'fantasy', menu: [['Plüsch-Fee', 15.9], ['Zauberstab', 8.9], ['Spielzeug-Set', 22.9]] },
  { id: 'sh-ber', kind: 'shop', name: 'Fotoshop & Souvenirs', zone: 'berlin', menu: [['Foto-Abzug', 9.9], ['Magnet', 4.5], ['Plüschtier', 17.9], ['Süßigkeiten-Tüte', 5.5]] },
  { id: 'sh-chi', kind: 'shop', name: 'Laternen-Laden', zone: 'china', menu: [['Laterne', 12.9], ['Fächer', 7.9], ['Teeset', 22.9]] },
  { id: 'r-mys', kind: 'restaurant', name: 'Burgschänke Düsterwald', zone: 'mystery', menu: [['Linsen-Knochensuppe', 8.9], ['Raben-Brot mit Käse', 7.5], ['Gruselburger', 12.5], ['Zaubertrank (Fruchtsaft)', 4.2]] },
  { id: 'sh-wuze', kind: 'shop', name: 'Wuze-Laden', zone: 'fantasy', menu: [['Plüsch-Wuze', 16.9], ['Leuchtstab', 7.9], ['Wuze-Mütze', 12.5]] },
  // Fahrgeschäfte zum Mitfahren (Rundfahrt mit der Spielerfigur; Karussell-Typen ohne Strecke) – Namen laut Beschreibung, Umsetzung stilisiert
  { id: 'f-pferd', kind: 'flat', flat: 'carousel', name: 'Pferdekarussell', zone: 'berlin', at: [-84, 108] },
  { id: 'f-wave', kind: 'flat', flat: 'wave', name: 'Wellenflug', zone: 'berlin', at: [96, 0] },
  { id: 'f-tree', kind: 'flat', flat: 'tree', name: 'Tittle Tattle Tree', zone: 'fantasy', at: [64, 282] },
  // Adventure Trail (Deep in Africa): Wegpunkt-Tour durch den Dschungel mit Zeitlimit und Belohnung (Spielgeld)
  { id: 'a-trail', kind: 'trail', name: 'Adventure Trail', zone: 'africa', at: [-300, 30], menu: [], cps: 5, limit: 420, reward: 60 },
  // Shows (Zeiten in Spielstunden)
  { id: 'st-ber', kind: 'stage', name: 'Theater am Kaiserplatz', zone: 'berlin', shows: [['Tagesshow', [12, 15]], ['Abendshow', [19.5, 21.5]]] },
  { id: 'st-chi', kind: 'stage', name: 'Bühne im Garten', zone: 'china', shows: [['Tanz & Lichter', [14, 18, 20.5]]] },
  // Toiletten
  { id: 'wc1', kind: 'wc', name: 'Toiletten', zone: 'berlin' }, { id: 'wc2', kind: 'wc', name: 'Toiletten', zone: 'klugheim' }, { id: 'wc3', kind: 'wc', name: 'Toiletten', zone: 'africa' }, { id: 'wc4', kind: 'wc', name: 'Toiletten', zone: 'rookburgh' },
];

export const TICKETS = [['Tageskarte', 59], ['Kinder-Tageskarte', 49], ['Abendticket (ab 17 Uhr)', 39]];

const RESTS = POIS.filter(p => p.kind === 'restaurant').length;
export const ACHIEVEMENTS = [
  ['first', 'Erste Achterbahnfahrt', 'Fahre eine Achterbahn', s => s.rides >= 1, s => Math.min(1, s.rides / 1)],
  ['taron', 'Taron gefahren', 'Fahre Taron', s => !!s.rideBy['Taron'], s => s.rideBy['Taron'] ? 1 : 0],
  ['fly', 'F.L.Y. gefahren', 'Fahre F.L.Y.', s => !!s.rideBy['F.L.Y.'], s => s.rideBy['F.L.Y.'] ? 1 : 0],
  ['mamba', 'Black Mamba gefahren', 'Fahre Black Mamba', s => !!s.rideBy['Black Mamba'], s => s.rideBy['Black Mamba'] ? 1 : 0],
  ['allcoasters', 'Alle Achterbahnen gefahren', 'Fahre alle 8 Achterbahnen', s => s.coasterCount >= 8, s => Math.min(1, s.coasterCount / 8)],
  ['rides10', '10 Fahrten', '10 Fahrten insgesamt', s => s.rides >= 10, s => Math.min(1, s.rides / 10)],
  ['rides100', '100 Fahrten', '100 Fahrten insgesamt', s => s.rides >= 100, s => Math.min(1, s.rides / 100)],
  ['rides1000', '1000 Fahrten', '1000 Fahrten insgesamt', s => s.rides >= 1000, s => Math.min(1, s.rides / 1000)],
  ['zones', 'Alle Themenwelten besucht', 'Besuche alle 8 Themenwelten', s => s.zoneCount >= 8, s => Math.min(1, s.zoneCount / 8)],
  ['food', 'Alle Restaurants besucht', 'Betrete alle Restaurants', s => s.restCount >= RESTS, s => Math.min(1, s.restCount / RESTS)],
  ['hotels', 'Alle Hotels erkundet', 'Betrete alle 3 Hotels', s => s.hotelCount >= 3, s => Math.min(1, s.hotelCount / 3)],
  ['winter', 'Wintertraum erlebt', 'Schalte den Wintertraum ein', s => !!s.flags.winter, s => s.flags.winter ? 1 : 0],
  ['night', 'Nachtfahrt', 'Fahre bei Nacht', s => !!s.flags.nightRide, s => s.flags.nightRide ? 1 : 0],
  ['photo', 'Fotograf', 'Mache 5 Fotos', s => s.photos >= 5, s => Math.min(1, s.photos / 5)],
  ['shopper', 'Souvenir gekauft', 'Kaufe etwas im Shop', s => s.purchases >= 1, s => Math.min(1, s.purchases / 1)],
  ['stay', 'Übernachtet', 'Buche einen Hotelaufenthalt', s => s.bookings >= 1, s => Math.min(1, s.bookings / 1)],
  ['editor', 'Achterbahn-Baumeister', 'Speichere eine eigene Achterbahn', s => s.designs >= 1, s => Math.min(1, s.designs / 1)],
  ['skin', 'Neuer Look', 'Kaufe deinen ersten Skin', s => s.skins >= 2, s => Math.min(1, Math.max(0, s.skins - 1) / 1)],
  ['stil', 'Stilikone', 'Besitze 6 Skins', s => s.skins >= 6, s => Math.min(1, s.skins / 6)],
  ['flats', 'Karussell-Fan', 'Fahre Pferdekarussell, Wellenflug und Tittle Tattle Tree', s => s.flatCount >= 3, s => Math.min(1, s.flatCount / 3)],
  ['km', '10 km gefahren', 'Fahre insgesamt 10 km', s => s.km >= 10, s => Math.min(1, s.km / 10)],
  ['trail', 'Abenteurer', 'Schließe den Adventure Trail in Deep in Africa ab', s => !!(s.flags && s.flags.trail), s => (s.flags && s.flags.trail) ? 1 : 0],
];

// ---------------------------------------------------------------------------------------------------------------
// Themenwelten (Beschreibungen nach der Vorlage des Nutzers; Umsetzung im Spiel stilisiert, keine Originalpläne).
// Sechs Hauptwelten (main) + Rookburgh (zu Berlin) und Klugheim (zu Mystery) als besonders gestaltete Unterbereiche.
export const WORLDS = [
  { key: 'berlin', name: 'Berlin', tag: 'Die goldenen 1920er-Jahre', main: true,
    desc: 'Nostalgische Großstadt: mehrstöckige Stadthäuser mit Stuck, hohen Fenstern, schmiedeeisernen Balkonen, Markisen und Schaufenstern, alte Straßenlaternen und gepflasterte Plätze – im Zentrum der Kaiserplatz.',
    look: ['Stuck & verzierte Fassaden', 'Balkone mit Eisengeländer', 'Markisen über Schaufenstern', 'Laternen im alten Stil', 'Kaiserplatz mit Brunnen'], mood: 'gemütlich, elegant und lebendig', sound: 'Salonmusik mit Klavier' },
  { key: 'rookburgh', name: 'Rookburgh', tag: 'Eine Stadt zwischen Himmel und Erde', parent: 'Berlin',
    desc: 'Eng und dicht gebaute Steampunk-Industriestadt der Flugpioniere: dunkle Metallfassaden, Ziegelwände, Werkstätten, Rohre, Schornsteine mit Dampf, Zahnräder und fantasievolle Flugmaschinen.',
    look: ['Rostbraun, Schwarz, Kupfer, Ziegelrot', 'Rohre & Schornsteine mit Dampf', 'Zahnräder an den Fassaden', 'Flugmaschinen über den Gassen', 'warme Lichter in schmalen Gassen'], mood: 'dunkel, geheimnisvoll, technisch und aufregend', sound: 'Maschinen-Rhythmus & Dampf' },
  { key: 'mexico', name: 'Mexico', tag: 'Eine farbenfrohe Welt voller Sonne', main: true,
    desc: 'Bunte Fassaden in Gelb, Orange, Rot und Türkis, große Torbögen, Markthäuser, künstliche Felsformationen mit Kakteen und Wasser – dazu der Maya-Tempel Talocan mit Feuer- und Wassereffekten und die Wasserbahn Chiapas.',
    look: ['Bunte Fassaden & Torbögen', 'Markthäuser mit Markisen', 'Felsen, Kakteen, Wasserfälle', 'Stufentempel mit Fackeln', 'Fähnchenketten'], mood: 'warm, lebendig und fröhlich', sound: 'Fiesta mit Gitarre und Rasseln' },
  { key: 'mystery', name: 'Mystery', tag: 'Eine düstere Welt voller Geheimnisse', main: true,
    desc: 'Dunkle Steinmauern, massive Türme, alte Holzbalken, schmale Wege, geheimnisvolle Symbole und ungewöhnliche Figuren – im Zentrum die große Burganlage Mystery Castle mit hohem Turm.',
    look: ['Dunkle Burg mit hohem Turm', 'Wehrmauern & Wachtürme', 'Leuchtende Runensteine', 'Wasserspeier & Kapuzenfiguren', 'blaue Fackeln im Nebel'], mood: 'düster, verwittert und geheimnisvoll', sound: 'Dunkle Klangflächen & ferne Glocke' },
  { key: 'klugheim', name: 'Klugheim', tag: 'Das sagenumwobene Dorf', parent: 'Mystery',
    desc: 'Mittelalterliches Dorf zwischen gewaltigen Basaltfelsen: schiefe Dächer, dunkle Holzbalken, Steinwände, kleine Fenster, rustikale Türen. Taron und Raik schießen durch Dorf und Felsen, Rutmor\'s Taverne lädt zum Einkehren ein.',
    look: ['Schiefe, unregelmäßige Dächer', 'Dunkles Fachwerk & Steinwände', 'Hohe Basaltsäulen', 'Brücken & Bahnstrecken zwischen Felsen', 'Rutmor\'s Taverne'], mood: 'uralt, geheimnisvoll und mächtig', sound: 'Laute im Mittelalter-Stil' },
  { key: 'africa', name: 'Deep in Africa', tag: 'Eine Reise durch die Wildnis', main: true,
    desc: 'Afrikanisch inspirierte Dörfer in Erdfarben, Holz und Stein mit Wandmustern und Marktständen, dazu dichter Dschungel mit Palmen, Wasserläufen und moosigen Felsen. Black Mamba, der Adventure Trail und das Hotel Matamba.',
    look: ['Erdfarben, Holz & Stein', 'Wandmuster & Marktstände', 'Dichter Dschungel, Palmen', 'Moosige Felsen & Lagune', 'Adventure Trail mit Brücken'], mood: 'lebendig, exotisch und naturverbunden', sound: 'Trommeln, Vögel, Dschungel' },
  { key: 'china', name: 'China Town', tag: 'Eine fernöstliche Welt', main: true,
    desc: 'Ruhig, harmonisch und elegant: geschwungene Dächer, goldene und grüne Dachziegel, rote Säulen, Pagoden, Tore und kleine Gärten. Hotel Ling Bao im Palast-Stil, Geister Rikscha und Feng Ju Palace.',
    look: ['Geschwungene Dächer mit goldenen Firsten', 'Rote Säulen & Gittermuster', 'Pagoden & Torbögen', 'Gärten, Teich, Bambus', 'Laternen'], mood: 'ruhig, geheimnisvoll und harmonisch', sound: 'Pentatonische Zupfklänge' },
  { key: 'fantasy', name: 'Fantasy', tag: 'Eine verspielte Welt voller Fantasie', main: true,
    desc: 'Märchenhafte Häuser, bunte Fassaden, fantasievolle Figuren und ungewöhnliche Gebäudeformen. Darin liegt Wuze Town – eine Stadt zwischen futuristischer Architektur und Märchen, mit Würmling Express und Tittle Tattle Tree; außerdem Winja\'s Fear und Winja\'s Force.',
    look: ['Pilz- und Zipfelhäuser in Pastell', 'Verspielte Dekorationen', 'Wuze Town mit runden Neon-Bauten', 'Wuze-Figuren', 'bunte Laternen'], mood: 'fröhlich, bunt und voller Fantasie', sound: 'Spieluhr-Klänge' },
];
// Benannte Unterbereiche (nur für Namenseinblendung/Karte; die Zonen selbst bleiben die acht oben)
export const SUBAREAS = [
  { key: 'kaiserplatz', zone: 'berlin', name: 'Kaiserplatz', tag: 'das Herz von Berlin', x: 0, z: 60, r: 52 },
  { key: 'wuze', zone: 'fantasy', name: 'Wuze Town', tag: 'die Stadt der Wuze', x: 80, z: 300, r: 62 },
];
