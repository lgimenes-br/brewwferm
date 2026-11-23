// Familias de estilo para o Breww.AI: faixa de temperatura de fermentacao primaria e atenuacao aparente
// tipicas (pratica cervejeira caseira, alinhada as orientacoes do BJCP e dos fabricantes de fermento).
// Sao referencias para avisos ("quente demais para uma lager"), nao regras rigidas: o fermento usado manda.

export const STYLE_FAMILIES = [
    {
        key: 'lager', label: 'Lager', lager: true, temp: [9, 14], att: [72, 82], diacetylRest: true,
        words: ['lager', 'pilsen', 'pilsner', 'pils', 'helles', 'bock', 'doppelbock', 'marzen', 'märzen', 'oktoberfest',
            'vienna', 'viena', 'schwarzbier', 'maibock', 'eisbock', 'dunkel', 'kellerbier', 'dortmunder', 'american lager', 'premium lager', 'rauchbier', 'baltic'],
    },
    {
        key: 'kveik', label: 'Kveik', temp: [25, 37], att: [75, 85],
        words: ['kveik', 'voss', 'hornindal'],
    },
    {
        key: 'saison', label: 'Saison / farmhouse', temp: [20, 30], att: [85, 95],
        words: ['saison', 'farmhouse', 'biere de garde', 'bière de garde'],
    },
    {
        key: 'belgian', label: 'Belga', temp: [18, 26], att: [76, 88],
        words: ['belga', 'belgian', 'tripel', 'dubbel', 'quadrupel', 'quad', 'witbier', 'wit', 'blond belga', 'golden strong', 'abbey', 'trapist'],
    },
    {
        key: 'wheat', label: 'Trigo alemã', temp: [17, 22], att: [72, 80],
        words: ['weiss', 'weizen', 'hefe', 'hefeweizen', 'hefeweiss', 'weissbier', 'weizenbier', 'kristallweizen', 'dunkelweizen', 'weizenbock', 'trigo', 'wheat'],
    },
    {
        key: 'hoppy', label: 'IPA / pale ale', temp: [17, 21], att: [75, 82], dryHop: true,
        words: ['ipa', 'pale ale', 'apa', 'neipa', 'hazy', 'double ipa', 'dipa', 'session ipa', 'west coast', 'red ipa', 'black ipa'],
    },
    {
        key: 'dark', label: 'Stout / porter', temp: [17, 21], att: [68, 78],
        words: ['stout', 'porter', 'imperial stout', 'milk stout', 'oatmeal'],
    },
    {
        key: 'ale', label: 'Ale', temp: [17, 22], att: [70, 80],
        words: ['ale', 'bitter', 'esb', 'amber', 'red ale', 'brown', 'blonde', 'blond', 'golden', 'kolsch', 'kölsch', 'altbier', 'scotch', 'barleywine', 'cream ale'],
    },
];

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Familia pelo nome do estilo ou do lote; null se nao reconhecer. A ordem acima decide os empates. */
export const matchStyle = (...texts) => {
    const t = ` ${texts.map(norm).join(' ')} `.replace(/[^a-z0-9]+/g, ' ');
    for (const f of STYLE_FAMILIES) {
        if (f.words.some((w) => t.includes(` ${norm(w).replace(/[^a-z0-9]+/g, ' ').trim()} `))) return f;
    }
    return null;
};
