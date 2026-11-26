(function () {
  'use strict';

  const KEY = 'portal.lang';
  const LANGUAGES = { en: 'English', zh: '中文', es: 'Español', fr: 'Français', de: 'Deutsch', ja: '日本語' };

  const T = {
    en: {
      'nav.explore': 'Explore',
      'nav.together': 'Discover together',
      'nav.observatory': 'Observatory',
      'nav.evidence': 'Evidence Lab',
      'nav.cloud': 'Cloud guide',
      'nav.bio': 'AI & biology',
      'hero.h1': 'Follow an idea somewhere unexpected.',
      'hero.cta.explore': 'Explore the archive',
      'hero.cta.together': 'Discover together',
      'hero.cta.how': 'How it works',
      'discover.eyebrow': 'BEGIN YOUR DISCOVERY',
      'discover.title': 'Enter The Portal',
      'discover.placeholder': 'Ask a question · describe an observation · explore an idea',
      'discover.submit': 'BEGIN YOUR DISCOVERY',
      'discover.surprise': 'SURPRISE ME',
      'together.title': 'Discover together.',
      'rooms.title': 'Open discovery rooms',
      'create.title': 'Pose a question for collective investigation',
      'create.topic': 'Topic',
      'create.question': 'Question (optional)',
      'create.consent': 'I consent to publishing this room anonymously.',
      'create.submit': 'CREATE ROOM',
      'contribute.title': 'Contribute to collective discovery',
      'contribute.submit': 'SUBMIT',
      'obs.title': 'Open Intelligence Observatory',
      'footer.line1': 'Popularity is never treated as truth.'
    },
    zh: {
      'nav.explore': '探索',
      'nav.together': '共同发现',
      'nav.observatory': '观察站',
      'nav.evidence': '证据实验室',
      'nav.cloud': '云端指南',
      'nav.bio': 'AI 与生物学',
      'hero.h1': '跟随一个想法，去往意想不到之处。',
      'hero.cta.explore': '探索档案',
      'hero.cta.together': '共同发现',
      'hero.cta.how': '运作方式',
      'discover.eyebrow': '开始你的发现',
      'discover.title': '进入 The Portal',
      'discover.placeholder': '提问 · 描述观察 · 探索想法',
      'discover.submit': '开始发现',
      'discover.surprise': '给我惊喜',
      'together.title': '一起发现。',
      'rooms.title': '开放发现室',
      'create.title': '提出一个共同探索的问题',
      'create.topic': '主题',
      'create.question': '问题（可选）',
      'create.consent': '我同意匿名发布这个发现室。',
      'create.submit': '创建房间',
      'contribute.title': '为集体发现作出贡献',
      'contribute.submit': '提交',
      'obs.title': '开放智能观察站',
      'footer.line1': '受欢迎程度永远不等于真相。'
    },
    es: {
      'nav.explore': 'Explorar',
      'nav.together': 'Descubrir juntos',
      'nav.observatory': 'Observatorio',
      'nav.evidence': 'Laboratorio de evidencia',
      'nav.cloud': 'Guía de nube',
      'nav.bio': 'IA y biología',
      'hero.h1': 'Sigue una idea a un lugar inesperado.',
      'hero.cta.explore': 'Explorar el archivo',
      'hero.cta.together': 'Descubrir juntos',
      'hero.cta.how': 'Cómo funciona',
      'discover.eyebrow': 'COMIENZA TU DESCUBRIMIENTO',
      'discover.title': 'Entra al Portal',
      'discover.placeholder': 'Haz una pregunta · describe una observación · explora una idea',
      'discover.submit': 'COMENZAR',
      'discover.surprise': 'SORPRÉNDEME',
      'together.title': 'Descubramos juntos.',
      'rooms.title': 'Salas de descubrimiento abiertas',
      'create.title': 'Plantea una pregunta para investigar juntos',
      'create.topic': 'Tema',
      'create.question': 'Pregunta (opcional)',
      'create.consent': 'Consiento publicar esta sala de forma anónima.',
      'create.submit': 'CREAR SALA',
      'contribute.title': 'Contribuye al descubrimiento colectivo',
      'contribute.submit': 'ENVIAR',
      'obs.title': 'Observatorio de Inteligencia Abierta',
      'footer.line1': 'La popularidad nunca se trata como verdad.'
    },
    fr: {
      'nav.explore': 'Explorer',
      'nav.together': 'Découvrir ensemble',
      'nav.observatory': 'Observatoire',
      'nav.evidence': 'Laboratoire de preuves',
      'nav.cloud': 'Guide cloud',
      'nav.bio': 'IA et biologie',
      'hero.h1': 'Suivez une idée vers un endroit inattendu.',
      'hero.cta.explore': 'Explorer les archives',
      'hero.cta.together': 'Découvrir ensemble',
      'hero.cta.how': 'Comment ça marche',
      'discover.eyebrow': 'COMMENCEZ VOTRE DÉCOUVERTE',
      'discover.title': 'Entrez dans le Portail',
      'discover.placeholder': 'Posez une question · décrivez une observation · explorez une idée',
      'discover.submit': 'COMMENCER',
      'discover.surprise': 'SURPRENEZ-MOI',
      'together.title': 'Découvrons ensemble.',
      'rooms.title': 'Salles de découverte ouvertes',
      'create.title': 'Posez une question pour une enquête collective',
      'create.topic': 'Sujet',
      'create.question': 'Question (facultatif)',
      'create.consent': 'Je consens à publier cette salle de façon anonyme.',
      'create.submit': 'CRÉER LA SALLE',
      'contribute.title': 'Contribuez à la découverte collective',
      'contribute.submit': 'ENVOYER',
      'obs.title': 'Observatoire de l’intelligence ouverte',
      'footer.line1': 'La popularité n’est jamais traitée comme la vérité.'
    },
    de: {
      'nav.explore': 'Erkunden',
      'nav.together': 'Gemeinsam entdecken',
      'nav.observatory': 'Observatorium',
      'nav.evidence': 'Evidenzlabor',
      'nav.cloud': 'Cloud-Leitfaden',
      'nav.bio': 'KI & Biologie',
      'hero.h1': 'Folge einer Idee an einen unerwarteten Ort.',
      'hero.cta.explore': 'Archiv erkunden',
      'hero.cta.together': 'Gemeinsam entdecken',
      'hero.cta.how': 'So funktioniert es',
      'discover.eyebrow': 'BEGINNE DEINE ENTDECKUNG',
      'discover.title': 'Betritt das Portal',
      'discover.placeholder': 'Stelle eine Frage · beschreibe eine Beobachtung · erkunde eine Idee',
      'discover.submit': 'STARTEN',
      'discover.surprise': 'ÜBERRASCHE MICH',
      'together.title': 'Entdecken wir gemeinsam.',
      'rooms.title': 'Offene Entdeckungsräume',
      'create.title': 'Stelle eine Frage für gemeinsame Forschung',
      'create.topic': 'Thema',
      'create.question': 'Frage (optional)',
      'create.consent': 'Ich willige ein, diesen Raum anonym zu veröffentlichen.',
      'create.submit': 'RAUM ERSTELLEN',
      'contribute.title': 'Zur kollektiven Entdeckung beitragen',
      'contribute.submit': 'SENDEN',
      'obs.title': 'Offenes Intelligenz-Observatorium',
      'footer.line1': 'Popularität wird niemals als Wahrheit behandelt.'
    },
    ja: {
      'nav.explore': '探索',
      'nav.together': 'みんなで発見',
      'nav.observatory': '観測所',
      'nav.evidence': '証拠ラボ',
      'nav.cloud': 'クラウドガイド',
      'nav.bio': 'AIと生物学',
      'hero.h1': 'アイデアを追って、思いがけない場所へ。',
      'hero.cta.explore': 'アーカイブを探索',
      'hero.cta.together': 'みんなで発見',
      'hero.cta.how': '仕組み',
      'discover.eyebrow': '発見を始める',
      'discover.title': 'ポータルへ',
      'discover.placeholder': '質問する · 観察を述べる · アイデアを探る',
      'discover.submit': '始める',
      'discover.surprise': 'サプライズ',
      'together.title': 'みんなで発見しましょう。',
      'rooms.title': '公開ディスカバリールーム',
      'create.title': '共同調査の問いを立てる',
      'create.topic': 'トピック',
      'create.question': '問い（任意）',
      'create.consent': '匿名でこのルームを公開することに同意します。',
      'create.submit': 'ルームを作成',
      'contribute.title': '集合的発見に貢献する',
      'contribute.submit': '送信',
      'obs.title': 'オープンインテリジェンス観測所',
      'footer.line1': '人気は決して真実として扱われません。'
    }
  };

  function apply(lang) {
    document.documentElement.lang = lang;
    const dict = T[lang] || T.en;
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const value = dict[el.getAttribute('data-i18n')];
      if (value) el.textContent = value;
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const value = dict[el.getAttribute('data-i18n-placeholder')];
      if (value) el.setAttribute('placeholder', value);
    });
  }

  function buildSelector(current) {
    const select = document.createElement('select');
    select.className = 'lang-switch';
    select.setAttribute('aria-label', 'Language');
    for (const [code, label] of Object.entries(LANGUAGES)) {
      const option = document.createElement('option');
      option.value = code;
      option.textContent = label;
      if (code === current) option.selected = true;
      select.appendChild(option);
    }
    select.addEventListener('change', () => {
      localStorage.setItem(KEY, select.value);
      apply(select.value);
    });
    return select;
  }

  const current = localStorage.getItem(KEY) || 'en';
  apply(current);
  document.querySelectorAll('[data-lang-switch]').forEach(host => host.appendChild(buildSelector(current)));
})();
