/* KNOWN Daily daily quote library: user-supplied quotations and source attributions. */
(() => {
  'use strict';
  const QUOTES = [
  {
    "text": "Wealth from get-rich-quick schemes quickly disappears; wealth from hard work grows over time.",
    "author": "Proverbs 13:11",
    "source": "Holy Bible, New Living Translation",
    "url": "https://www.biblegateway.com/passage/?search=Proverbs%2013%3A11&version=NLT",
    "nlt": true
  },
  {
    "text": "Good planning and hard work lead to prosperity, but hasty shortcuts lead to poverty.",
    "author": "Proverbs 21:5",
    "source": "Holy Bible, New Living Translation",
    "url": "https://www.biblegateway.com/passage/?search=Proverbs%2021%3A5&version=NLT",
    "nlt": true
  },
  {
    "text": "Whatever you do, do well. For when you go to the grave, there will be no work or planning or knowledge or wisdom.",
    "author": "Ecclesiastes 9:10",
    "source": "Holy Bible, New Living Translation",
    "url": "https://www.biblegateway.com/passage/?search=Ecclesiastes%209%3A10&version=NLT",
    "nlt": true
  },
  {
    "text": "The faithful love of the LORD never ends! His mercies never cease. Great is his faithfulness; his mercies begin afresh each morning.",
    "author": "Lamentations 3:22–23",
    "source": "Holy Bible, New Living Translation",
    "url": "https://www.biblegateway.com/passage/?search=Lamentations%203%3A22-23&version=NLT",
    "nlt": true
  },
  {
    "text": "Do not despise these small beginnings, for the LORD rejoices to see the work begin, to see the plumb line in Zerubbabel's hand.",
    "author": "Zechariah 4:10",
    "source": "Holy Bible, New Living Translation",
    "url": "https://www.biblegateway.com/passage/?search=Zechariah%204%3A10&version=NLT",
    "nlt": true
  },
  {
    "text": "Well done, my good and faithful servant. You have been faithful in handling this small amount, so now I will give you many more responsibilities.",
    "author": "Matthew 25:21",
    "source": "Holy Bible, New Living Translation",
    "url": "https://www.biblegateway.com/passage/?search=Matthew%2025%3A21&version=NLT",
    "nlt": true
  },
  {
    "text": "The earth produces the crops on its own. First a leaf blade pushes through, then the heads of wheat are formed, and finally the grain ripens.",
    "author": "Mark 4:28",
    "source": "Holy Bible, New Living Translation",
    "url": "https://www.biblegateway.com/passage/?search=Mark%204%3A28&version=NLT",
    "nlt": true
  },
  {
    "text": "If any of you wants to be my follower, you must give up your own way, take up your cross daily, and follow me.",
    "author": "Luke 9:23",
    "source": "Holy Bible, New Living Translation",
    "url": "https://www.biblegateway.com/passage/?search=Luke%209%3A23&version=NLT",
    "nlt": true
  },
  {
    "text": "If you are faithful in little things, you will be faithful in large ones. But if you are dishonest in little things, you won't be honest with greater responsibilities.",
    "author": "Luke 16:10",
    "source": "Holy Bible, New Living Translation",
    "url": "https://www.biblegateway.com/passage/?search=Luke%2016%3A10&version=NLT",
    "nlt": true
  },
  {
    "text": "That is why we never give up. Though our bodies are dying, our spirits are being renewed every day.",
    "author": "2 Corinthians 4:16",
    "source": "Holy Bible, New Living Translation",
    "url": "https://www.biblegateway.com/passage/?search=2%20Corinthians%204%3A16&version=NLT",
    "nlt": true
  },
  {
    "text": "So let's not get tired of doing what is good. At just the right time we will reap a harvest of blessing if we don't give up.",
    "author": "Galatians 6:9",
    "source": "Holy Bible, New Living Translation",
    "url": "https://www.biblegateway.com/passage/?search=Galatians%206%3A9&version=NLT",
    "nlt": true
  },
  {
    "text": "Work willingly at whatever you do, as though you were working for the Lord rather than for people.",
    "author": "Colossians 3:23",
    "source": "Holy Bible, New Living Translation",
    "url": "https://www.biblegateway.com/passage/?search=Colossians%203%3A23&version=NLT",
    "nlt": true
  },
  {
    "text": "He who adds to what he has, will keep off bright-eyed hunger; for if you add only a little to a little and do this often, soon that little will become great.",
    "author": "Hesiod",
    "source": "Works and Days, lines 360–363; trans. Hugh G. Evelyn-White (1914)",
    "url": "https://cts.perseids.org/read/greekLit/tlg0020/tlg002/perseus-eng2/360-380",
    "nlt": false
  },
  {
    "text": "Do not put your work off till to-morrow and the day after; for a sluggish worker does not fill his barn, nor one who puts off his work: industry makes work go well, but a man who puts off work is always at hand-grips with ruin.",
    "author": "Hesiod",
    "source": "Works and Days, lines 410–413; trans. Hugh G. Evelyn-White (1914)",
    "url": "https://cts.perseids.org/read/greekLit/tlg0020/tlg002/perseus-eng2/385-420",
    "nlt": false
  },
  {
    "text": "The beginning is the most important part of any work, especially in the case of a young and tender thing; for that is the time at which the character is being formed and the desired impression is more readily taken.",
    "author": "Socrates (in Plato)",
    "source": "Republic, Book II, 377a–b; trans. Benjamin Jowett",
    "url": "https://www.gutenberg.org/ebooks/1497",
    "nlt": false
  },
  {
    "text": "For of all things good and fair, the gods give nothing to man without toil and effort.",
    "author": "Prodicus (as retold by Socrates)",
    "source": "Xenophon, Memorabilia 2.1.28; trans. E. C. Marchant (1923)",
    "url": "https://cts.perseids.org/read/greekLit/tlg0032/tlg002/perseus-eng2/2.1.26-2.1.32",
    "nlt": false
  },
  {
    "text": "Men become builders by building and lyreplayers by playing the lyre; so too we become just by doing just acts, temperate by doing temperate acts, brave by doing brave acts.",
    "author": "Aristotle",
    "source": "Nicomachean Ethics II.1, 1103a33–b2; trans. W. D. Ross",
    "url": "https://classics.mit.edu/Aristotle/nicomachaen.2.ii.html",
    "nlt": false
  },
  {
    "text": "Thus, in one word, states of character arise out of like activities. This is why the activities we exhibit must be of a certain kind; it is because the states of character correspond to the differences between these. It makes no small difference, then, whether we form habits of one kind or of another from our very youth; it makes a very great difference, or rather all the difference.",
    "author": "Aristotle",
    "source": "Nicomachean Ethics II.1, 1103b21–25; trans. W. D. Ross",
    "url": "https://classics.mit.edu/Aristotle/nicomachaen.2.ii.html",
    "nlt": false
  },
  {
    "text": "For one swallow does not make a summer, nor does one day; and so too one day, or a short time, does not make a man blessed and happy.",
    "author": "Aristotle",
    "source": "Nicomachean Ethics I.7, 1098a18–20; trans. W. D. Ross",
    "url": "https://classics.mit.edu/Aristotle/nicomachaen.1.i.html",
    "nlt": false
  },
  {
    "text": "Well-being is attained by little and little, and nevertheless it is no little thing itself.",
    "author": "Zeno of Citium",
    "source": "Diogenes Laertius, Lives of Eminent Philosophers VII.26; trans. R. D. Hicks (1925)",
    "url": "https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Diogenes_Laertius/Lives_of_the_Eminent_Philosophers/7/Zeno*.html",
    "nlt": false
  },
  {
    "text": "Hold every hour in your grasp. Lay hold of to-day's task, and you will not need to depend so much upon to-morrow's. While we are postponing, life speeds by.",
    "author": "Seneca",
    "source": "Moral Letters to Lucilius 1.2; trans. Richard M. Gummere (1917)",
    "url": "https://en.wikisource.org/wiki/Moral_letters_to_Lucilius/Letter_1",
    "nlt": false
  },
  {
    "text": "Each day acquire something that will fortify you against poverty, against death, indeed against other misfortunes as well; and after you have run over many thoughts, select one to be thoroughly digested that day.",
    "author": "Seneca",
    "source": "Moral Letters to Lucilius 2.4; trans. Richard M. Gummere (1917)",
    "url": "https://pages.pomona.edu/~cmc24747/sources/seneca/sen_ep_1.htm",
    "nlt": false
  },
  {
    "text": "Nothing great, said Epictetus, is produced suddenly, since not even the grape or the fig is. If you say to me now that you want a fig, I will answer to you that it requires time: let it flower first, then put forth fruit, and then ripen.",
    "author": "Epictetus",
    "source": "Discourses I.15; trans. George Long (1890)",
    "url": "https://standardebooks.org/ebooks/epictetus/discourses/george-long/text/single-page",
    "nlt": false
  },
  {
    "text": "Every habit and faculty is maintained and increased by the corresponding actions: the habit of walking by walking, the habit of running by running. If you would be a good reader, read; if a writer, write.",
    "author": "Epictetus",
    "source": "Discourses II.18; trans. George Long (1890)",
    "url": "https://www.chlt.org/sandbox/perseus/epictetus_eng/page.48.a.php",
    "nlt": false
  },
  {
    "text": "Every moment think steadily as a Roman and a man to do what thou hast in hand with perfect and simple dignity, and feeling of affection, and freedom, and justice; and to give thyself relief from all other thoughts.",
    "author": "Marcus Aurelius",
    "source": "Meditations II.5; trans. George Long (1862)",
    "url": "https://classics.mit.edu/Antoninus/meditations.2.two.html",
    "nlt": false
  },
  {
    "text": "Ye see, men of my allies, that perseverance is more efficacious than violence, and that many things which cannot be mastered when they stand together yield when one masters them little by little. For irresistible is the force of continuity, by virtue of which advancing Time subdues and captures every power.",
    "author": "Sertorius (in Plutarch)",
    "source": "Life of Sertorius 16.5; trans. Bernadotte Perrin (1919)",
    "url": "https://lexundria.com/plut_sert/16/prr",
    "nlt": false
  },
  {
    "text": "He at least gave no thought to the past, but day by day, as if he were at the beginning of his discipline, applied greater pains for advancement.",
    "author": "Athanasius of Alexandria",
    "source": "Life of Antony §7; trans. H. Ellershaw (1892)",
    "url": "https://ccel.org/ccel/schaff/npnf204.xvi.ii.vi.html",
    "nlt": false
  },
  {
    "text": "Let this especially be the common aim of all, neither to give way having once begun, nor to faint in trouble, nor to say: We have lived in the discipline a long time: but rather as though making a beginning daily let us increase our earnestness.",
    "author": "Antony of Egypt",
    "source": "In Athanasius, Life of Antony §16; trans. H. Ellershaw (1892)",
    "url": "https://st-takla.org/books/en/ecf/204/2040222.html",
    "nlt": false
  },
  {
    "text": "Thou wishest to be great, begin from the least. Thou art thinking to construct some mighty fabric in height; first think of the foundation of humility. And how great soever a mass of building one may wish and design to place above it, the greater the building is to be, the deeper does he dig his foundation.",
    "author": "Augustine of Hippo",
    "source": "Sermon 69.2; NPNF translation (1888)",
    "url": "https://bkv.unifr.ch/works/cpl-284/versions/sermons-on-selected-lessons-of-the-new-testament/divisions/238",
    "nlt": false
  },
  {
    "text": "My will the enemy held, and thence had made a chain for me, and bound me. For of a forward will, was a lust made; and a lust served, became custom; and custom not resisted, became necessity.",
    "author": "Augustine of Hippo",
    "source": "Confessions VIII.5.10; trans. E. B. Pusey (1838)",
    "url": "https://ccel.org/ccel/augustine/confess.ix.v.html",
    "nlt": false
  },
  {
    "text": "Therefore, waiting and patience are needful, that we may fulfil that which we have begun to be, and may receive that which we believe and hope for, according to God's own showing.",
    "author": "Cyprian of Carthage",
    "source": "On the Advantage of Patience §13; trans. Ernest Wallis (1886)",
    "url": "https://bkv.unifr.ch/en/works/cpl-48/versions/on-the-advantage-of-patience/divisions/19",
    "nlt": false
  },
  {
    "text": "...allowing the water to fall drop by drop, it wears away the stone.",
    "author": "Abba Poemen of Scetis",
    "source": "The Sayings of the Desert Fathers, Poemen 183; trans. Benedicta Ward (1975)",
    "url": "",
    "nlt": false
  }
];
  const NLT_CREDIT = 'Scripture quotations are taken from the Holy Bible, New Living Translation, copyright © 1996, 2004, 2015 by Tyndale House Foundation. Used by permission of Tyndale House Publishers, Carol Stream, Illinois 60188. All rights reserved.';

  function dailyQuote(date = new Date()) {
    // A seeded Fisher-Yates shuffle creates a different, unpredictable-looking
    // order every 32-day cycle without repeating a quote within that cycle.
    // Based on the viewer's LOCAL calendar date, independent of other devices.
    const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
    const index = ((day % QUOTES.length) + QUOTES.length) % QUOTES.length;
    const cycle = Math.floor(day / QUOTES.length);
    let seed = (0x9e3779b9 ^ Math.imul(cycle + 1, 0x85ebca6b)) >>> 0;
    const random = () => {
      seed += 0x6d2b79f5;
      let t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const shuffled = QUOTES.slice();
    for(let i = shuffled.length - 1; i > 0; i--){
      const j = Math.floor(random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled[index];
  }

  window.KNOWN_DAILY_QUOTES = { dailyQuote, quotes: QUOTES, nltCredit: NLT_CREDIT };
})();
