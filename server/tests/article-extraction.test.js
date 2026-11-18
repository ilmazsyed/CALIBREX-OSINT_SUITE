import test from 'node:test';
import assert from 'node:assert/strict';
import { extractArticle } from '../article.js';

const paragraph='The government published a detailed statement describing the policy decision, the responsible departments, the implementation timetable, and the public evidence available for independent review. '.repeat(3);

test('article extraction preserves publisher title, publication time and readable text',()=>{
 const html=`<!doctype html><html><head><title>Example report</title><meta property="og:site_name" content="Example Publisher"><meta property="article:published_time" content="2026-11-17T10:00:00Z"><meta property="og:description" content="A detailed public report"></head><body><article><h1>Example report</h1><p>${paragraph}</p><p>${paragraph}</p></article></body></html>`;
 const article=extractArticle(html,'https://example.com/report');
 assert.match(article.title,/Example report/i);
 assert.equal(article.siteName,'Example Publisher');
 assert.equal(article.published,Date.parse('2026-11-17T10:00:00Z'));
 assert.ok(article.words>=60);
 assert.match(article.text,/implementation timetable/);
});

test('article extraction does not invent a publication timestamp',()=>{
 const article=extractArticle('<html><head><title>Undated page</title></head><body><article><p>Short page.</p></article></body></html>','https://example.com/undated');
 assert.equal(article.published,null);
});
