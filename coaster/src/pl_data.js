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
  ['Geister Rikscha', 'darkride', 'Berlin', 'ST DRV:2.2 S:14 TR:90:12:15 TL:90:12:15 TR:90:12:15 TL:90:12:15 TR:180:14:15 HOME:14:20', '#6a8a6a', 'Darkride (stilisiert)'],
  ['Hollywood Tour', 'darkride', 'Berlin', 'ST DRV:2.4 S:16 TL:90:14:15 TR:90:14:15 TL:90:14:15 TR:90:14:15 TR:180:16:15 HOME:16:20', '#c8a030', 'Darkride (stilisiert)'],
  ['Feng Ju Palace', 'darkride', 'China Town', 'ST DRV:2.2 S:12 TR:90:12:15 TL:90:12:15 TR:90:12:15 TL:90:12:15 TR:180:14:15 HOME:14:20', '#c8202e', 'Darkride (stilisiert)'],
];

export const ZONE_OF_AREA = { 'Klugheim': 'klugheim', 'Deep in Africa': 'africa', 'Rookburgh': 'rookburgh', 'Mexico': 'mexico', 'Fantasy': 'fantasy', 'China Town': 'china', 'Mystery': 'mystery', 'Berlin': 'berlin' };

// kind: restaurant | stand | shop | hotel | stage | wc | gate
export const POIS = [
  // Gastronomie
  { id: 'r-klug', kind: 'restaurant', name: 'Taverne im Felsendorf', zone: 'klugheim', menu: [['Eintopf im Brotlaib', 9.5], ['Wildschwein-Burger', 12.9], ['Kartoffelspalten', 5.5], ['Honigmet (alkoholfrei)', 4.2], ['Apfelkuchen', 5.9]] },
  { id: 's-klug1', kind: 'stand', name: 'Feuerstelle (Snacks)', zone: 'klugheim', menu: [['Stockbrot', 4.5], ['Bratwurst im Brötchen', 6.5], ['Glühwein-Saft', 4.0]] },
  { id: 'r-afr', kind: 'restaurant', name: 'Lodge-Restaurant', zone: 'africa', menu: [['Gemüsecurry', 11.9], ['Hähnchen-Spieß', 13.5], ['Bananen-Pfannkuchen', 6.9], ['Mango-Lassi', 4.9], ['Eistee', 3.8]] },
  { id: 's-afr1', kind: 'stand', name: 'Dschungel-Bar', zone: 'africa', menu: [['Fruchtcocktail (alkoholfrei)', 6.5], ['Kokosnuss-Wasser', 4.5], ['Mais-Snack', 4.2]] },
  { id: 'r-rook', kind: 'restaurant', name: 'Maschinenhalle (Restaurant)', zone: 'rookburgh', menu: [['Pasta Aeronaut', 10.9], ['Pizza Propeller', 11.5], ['Flammkuchen', 9.9], ['Cola', 3.9], ['Kaffee', 3.5], ['Schokokuchen', 5.5]] },
  { id: 's-rook1', kind: 'stand', name: 'Dampf-Imbiss', zone: 'rookburgh', menu: [['Pommes', 4.5], ['Currywurst', 6.9], ['Popcorn', 4.0]] },
  { id: 'r-mex', kind: 'restaurant', name: 'Cantina', zone: 'mexico', menu: [['Burrito', 10.5], ['Nachos mit Käse', 8.5], ['Quesadilla', 9.5], ['Limonade', 3.9]] },
  { id: 's-mex1', kind: 'stand', name: 'Churro-Wagen', zone: 'mexico', menu: [['Churros', 5.0], ['Eis am Stiel', 3.5], ['Fruchtbecher', 4.5]] },
  { id: 'r-chi', kind: 'restaurant', name: 'Teehaus & Nudelküche', zone: 'china', menu: [['Gebratene Nudeln', 10.9], ['Frühlingsrollen', 6.5], ['Bubble Tea', 5.5], ['Jasmin-Tee', 3.2]] },
  { id: 's-fan1', kind: 'stand', name: 'Märchen-Waffeln', zone: 'fantasy', menu: [['Waffel mit Kirschen', 5.5], ['Zuckerwatte', 4.0], ['Eis-Kugel', 2.2]] },
  { id: 'r-ber', kind: 'restaurant', name: 'Café an der Straße', zone: 'berlin', menu: [['Kaffee', 3.5], ['Kuchen des Tages', 4.9], ['Currywurst Pommes', 8.9], ['Schnitzel-Brötchen', 7.9], ['Limonade', 3.5]] },
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
  // Hotels (Namen echt; Zimmertypen/Preise frei ergänzt)
  { id: 'h-lind', kind: 'hotel', name: 'Hotel Charles Lindbergh', zone: 'rookburgh', rooms: [['Doppelzimmer', 189], ['Familienzimmer', 239], ['Suite', 329]] },
  { id: 'h-mat', kind: 'hotel', name: 'Hotel Matamba', zone: 'africa', rooms: [['Doppelzimmer', 179], ['Familienzimmer', 229], ['Suite', 319]] },
  { id: 'h-ling', kind: 'hotel', name: 'Ling Bao', zone: 'china', rooms: [['Doppelzimmer', 169], ['Familienzimmer', 219], ['Suite', 299]] },
  // Shows (Zeiten in Spielstunden)
  { id: 'st-ber', kind: 'stage', name: 'Theater am Hauptplatz', zone: 'berlin', shows: [['Tagesshow', [12, 15]], ['Abendshow', [19.5, 21.5]]] },
  { id: 'st-chi', kind: 'stage', name: 'Bühne im Garten', zone: 'china', shows: [['Tanz & Lichter', [14, 18, 20.5]]] },
  // Toiletten
  { id: 'wc1', kind: 'wc', name: 'Toiletten', zone: 'berlin' }, { id: 'wc2', kind: 'wc', name: 'Toiletten', zone: 'klugheim' }, { id: 'wc3', kind: 'wc', name: 'Toiletten', zone: 'africa' }, { id: 'wc4', kind: 'wc', name: 'Toiletten', zone: 'rookburgh' },
];

export const TICKETS = [['Tageskarte', 59], ['Kinder-Tageskarte', 49], ['Abendticket (ab 17 Uhr)', 39]];

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
  ['food', 'Alle Restaurants besucht', 'Betrete alle Restaurants', s => s.restCount >= 6, s => Math.min(1, s.restCount / 6)],
  ['hotels', 'Alle Hotels erkundet', 'Betrete alle 3 Hotels', s => s.hotelCount >= 3, s => Math.min(1, s.hotelCount / 3)],
  ['winter', 'Wintertraum erlebt', 'Schalte den Wintertraum ein', s => !!s.flags.winter, s => s.flags.winter ? 1 : 0],
  ['night', 'Nachtfahrt', 'Fahre bei Nacht', s => !!s.flags.nightRide, s => s.flags.nightRide ? 1 : 0],
  ['photo', 'Fotograf', 'Mache 5 Fotos', s => s.photos >= 5, s => Math.min(1, s.photos / 5)],
  ['shopper', 'Souvenir gekauft', 'Kaufe etwas im Shop', s => s.purchases >= 1, s => Math.min(1, s.purchases / 1)],
  ['stay', 'Übernachtet', 'Buche einen Hotelaufenthalt', s => s.bookings >= 1, s => Math.min(1, s.bookings / 1)],
  ['editor', 'Achterbahn-Baumeister', 'Speichere eine eigene Achterbahn', s => s.designs >= 1, s => Math.min(1, s.designs / 1)],
  ['skin', 'Neuer Look', 'Kaufe deinen ersten Skin', s => s.skins >= 2, s => Math.min(1, Math.max(0, s.skins - 1) / 1)],
  ['stil', 'Stilikone', 'Besitze 6 Skins', s => s.skins >= 6, s => Math.min(1, s.skins / 6)],
  ['km', '10 km gefahren', 'Fahre insgesamt 10 km', s => s.km >= 10, s => Math.min(1, s.km / 10)],
];
