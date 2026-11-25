import { escapeHtml, rupiah, stockMeta } from './util.js';

export function productCard(product, { reveal = true } = {}) {
  const stock = stockMeta(product.stock);
  const colors = (product.colors || [])
    .slice(0, 4)
    .map((color) => `<i style="background:${escapeHtml(color.hex)}" title="${escapeHtml(color.name)}"></i>`)
    .join('');

  return `
    <article class="product-card" ${reveal ? 'data-reveal' : ''}>
      <a class="product-card__media" href="/produk/${product.id}" aria-label="Lihat ${escapeHtml(product.name)}">
        <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)} oleh ${escapeHtml(product.brand)}" loading="lazy">
        ${product.badge ? `<span class="product-card__badge">${escapeHtml(product.badge)}</span>` : ''}
        <span class="product-card__view"><span>View piece</span><i class="fa-solid fa-arrow-right-long"></i></span>
      </a>
      <div class="product-card__body">
        <span class="product-card__brand">${escapeHtml(product.brand)}</span>
        <h3 class="product-card__name"><a href="/produk/${product.id}">${escapeHtml(product.name)}</a></h3>
        <div class="product-card__bottom">
          <span class="product-card__price">${rupiah(product.price)}</span>
          <span class="product-card__stock ${stock.cls}">${stock.label}</span>
        </div>
        ${colors ? `<div class="product-card__swatches">${colors}</div>` : ''}
      </div>
    </article>`;
}
