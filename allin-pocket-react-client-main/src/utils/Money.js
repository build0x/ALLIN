function currencyFormat(n, x, y, z) {
  const xc = Math.abs(x);
  var c = isNaN(xc) ? 2 : x,
    d = y ?? '.',
    t = z ?? ',',
    s = n < 0 ? '-' : '',
    i = String(parseInt((n = Math.abs(Number(n) || 0).toFixed(c)))),
    l = i.length,
    j = l > 3 ? l % 3 : 0;
  return (
    s +
    (j ? i.substr(0, j) + t : '') +
    i.substr(j).replace(/(\d{3})(?=\d)/g, '$1' + t) +
    (c
      ? d +
        Math.abs(n - i)
          .toFixed(c)
          .slice(2)
      : '')
  );
}

function trimTrailingZeros(value) {
  return String(value)
    .replace(/\.0$/, '')
    .replace(/(\.\d*[1-9])0+$/, '$1');
}

export function formatMoney(money) {
  const numeric = Number(money || 0);
  const abs = Math.abs(numeric);

  if (abs >= 1000000) {
    return `${trimTrailingZeros((numeric / 1000000).toFixed(abs >= 10000000 ? 0 : 1))}M`;
  }

  if (abs >= 1000) {
    return `${trimTrailingZeros((numeric / 1000).toFixed(abs >= 10000 ? 0 : 1))}k`;
  }

  const formatted = currencyFormat(numeric, 2, '.', ',');
  return formatted.replace(/\.00$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
}
