import axios from 'axios';
import * as cheerio from 'cheerio';

// Wikis que rodam sobre navegador têm bloqueio de CORS: sites de terceiros não
// liberam acesso via fetch/axios direto do browser. Por isso as chamadas passam
// por um proxy CORS público. Em produção, troque por uma function/proxy próprio.
const CORS_PROXY = 'https://corsproxy.io/?url=';

const WIKIS = {
  apogeawiki: 'https://apogeawiki.info',
  apogean: 'https://apogean.eu',
  fandom: 'https://apogea.fandom.com',
};

async function fetchHtml(url) {
  const { data } = await axios.get(CORS_PROXY + encodeURIComponent(url));
  return cheerio.load(data);
}

export async function scrapeMonster(name) {
  const url = `${WIKIS.fandom}/wiki/${encodeURIComponent(name)}`;
  const $ = await fetchHtml(url);

  const stats = {};
  $('.pi-item').each((_, el) => {
    const label = $(el).find('.pi-data-label').text().trim();
    const value = $(el).find('.pi-data-value').text().trim();
    if (label && value) stats[label] = value;
  });

  return {
    name,
    source: url,
    stats,
  };
}

export async function scrapeItem(name) {
  const url = `${WIKIS.apogeawiki}/wiki/${encodeURIComponent(name)}`;
  const $ = await fetchHtml(url);

  const stats = {};
  $('table.infobox tr').each((_, row) => {
    const cells = $(row).find('td, th');
    if (cells.length === 2) {
      const label = $(cells[0]).text().trim();
      const value = $(cells[1]).text().trim();
      if (label && value) stats[label] = value;
    }
  });

  return {
    name,
    source: url,
    stats,
  };
}

export async function searchWiki(query) {
  const url = `${WIKIS.apogean}/?s=${encodeURIComponent(query)}`;
  const $ = await fetchHtml(url);

  const results = [];
  $('a').each((_, el) => {
    const text = $(el).text().trim();
    const href = $(el).attr('href');
    if (text && href && text.toLowerCase().includes(query.toLowerCase())) {
      results.push({ text, href });
    }
  });

  return results;
}
