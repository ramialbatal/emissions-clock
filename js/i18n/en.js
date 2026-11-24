// @ts-check
/**
 * English words used by the code (messages.js and app.js). The page's own text is written in English in index.html;
 * fr.js, es.js and ar.js translate both: every key here, plus every data-i18n key in index.html.
 * Placeholders like {pct} are filled by clock-core's t(); keep them, in any order, in every translation.
 */
export default {
  // Page title, per gas
  "meta.title.co2": "Live CO₂ Emissions Clock: World and Countries in Real Time",
  "meta.title.ch4": "Live Methane Emissions Clock: World and Countries in Real Time",

  // The answer at the top (messages.js)
  "msg.co2.onTrack.t": "We're on track",
  "msg.co2.onTrack.x": "The world's CO₂ emissions are falling fast enough to keep the Paris goal in reach.",
  "msg.co2.close.t": "Almost on track",
  "msg.co2.close.x": "Emissions are falling, nearly fast enough. A little more effort keeps the Paris goal in reach.",
  "msg.co2.offTrack.t": "Falling, but far too slowly",
  "msg.co2.offTrack.x": "Emissions are coming down, but not nearly fast enough to keep warming under control.",
  "msg.co2.backwards.t": "We're heading the wrong way",
  "msg.co2.backwards.x": "The world still releases more CO₂ than a few years ago. To keep warming under control, it needs to fall fast.",
  "msg.ch4.down.t": "Methane is falling",
  "msg.ch4.down.x": "Good news: cutting methane is the fastest way to slow warming in the next few years.",
  "msg.ch4.flat.t": "Methane isn't falling yet",
  "msg.ch4.flat.x": "Methane traps a lot of heat. Cutting it is the fastest way to slow warming.",
  "msg.ch4.up.t": "Methane is still rising",
  "msg.ch4.up.x": "Methane traps a lot of heat. Cutting it is the fastest way to slow warming, but it keeps going up.",

  // Carbon budget and pace cards (messages.js)
  "msg.budget.none": "Nothing left at today's pace",
  "msg.budget.left": "About {years} years left at today's pace",
  "msg.budget.usedUp": "Used up",
  "msg.budget.almost": "Almost used up",
  "msg.budget.running": "Running out",
  "msg.budget.room": "Some room left",
  "msg.pace.should": "They should be {pct} lower than in {year} by now.",
  "msg.pace.higher": "They're {pct} higher.",
  "msg.pace.lower": "They're {pct} lower.",
  "msg.pace.same": "They're about the same.",
  "msg.pace.onTrack": "Yes, fast enough",
  "msg.pace.close": "Almost fast enough",
  "msg.pace.offTrack": "Falling, too slowly",
  "msg.pace.backwards": "No, still rising",
  "msg.badge.up": "▲ Rising",
  "msg.badge.down": "▼ Falling",
  "msg.badge.flat": "● Steady",

  // Cards and budget bars (app.js)
  "a.rest": "Rest of world",
  "a.partOf": "part of {name}",
  "a.tonnesIn": "tonnes in {year}",
  "a.shareTitle": "{pct} of the world total",
  "a.share": "{pct} of the world's {gas}",
  "a.more": "More",
  "a.perSecond": "Per second",
  "a.perPerson": "Per person / yr",
  "a.official": "{year} official",
  "a.expected": "{year} expected",
  "a.change": "Change / yr",
  "a.since": "Since you opened this page",
  "a.na": "n/a",
  "a.spark": "{name}: annual emissions {first} to {last}, {change}",
  "a.history": "Official annual emissions",
  "a.tLeft": "t left",
  "a.used": "{pct} used",
  "a.usedUp": "Used up.",
  "a.runsOut": "Runs out in about {years} years ({year}) at today's rate.",
  "a.safer": "Safer limit: {limit} of warming",
  "a.upper": "Upper limit: {limit} of warming",
  "a.fastEnough": "Are emissions falling fast enough?",
};
