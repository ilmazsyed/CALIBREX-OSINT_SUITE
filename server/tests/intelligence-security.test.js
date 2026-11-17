import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { scoreCorroborationResults } from '../feeds.js';
import { safeFetch, resolvePublicTarget } from '../article.js';

test('syndicated copies across domains count as one independent report', () => {
  const claim='Central Bank raises emergency interest rates after inflation surge';
  const results=[
    {title:'Central Bank raises emergency interest rates after inflation surge',url:'https://www.example.com/a',source:'Example',published:Date.now()},
    {title:'Central Bank raises emergency interest rates after inflation surge',url:'https://news.example.co.uk/b',source:'News Example',published:Date.now()},
    {title:'Central Bank raises emergency interest rates after inflation surge',url:'https://wire.example.net/c',source:'Wire Example',published:Date.now()}
  ];
  const scored=scoreCorroborationResults(claim,results);
  assert.equal(scored.independentDomains,1);
  assert.equal(scored.status,'LIMITED');
  assert.equal(scored.matches[0].clusterSize,3);
});

test('distinct publisher domains with different matching headlines can corroborate', () => {
  const claim='Central Bank raises emergency interest rates after inflation surge';
  const results=[
    {title:'Central Bank raises emergency interest rates after inflation surge',url:'https://alpha.com/a',source:'Alpha'},
    {title:'Central Bank hikes emergency interest rates amid inflation surge',url:'https://beta.org/b',source:'Beta'},
    {title:'Emergency interest rate increase by Central Bank as inflation surges',url:'https://gamma.net/c',source:'Gamma'}
  ];
  const scored=scoreCorroborationResults(claim,results);
  assert.ok(scored.independentDomains>=2);
});

test('headline matches alone never earn corroborated status', () => {
  const claim='Central Bank raises emergency interest rates after inflation surge';
  const results=['alpha.com','beta.org','gamma.net'].map((host,i)=>({
    title:[
      'Central Bank raises emergency interest rates after inflation surge',
      'Central Bank hikes emergency interest rates amid inflation surge',
      'Emergency interest rate increase by Central Bank as inflation surges'
    ][i],url:`https://${host}/story`,source:host
  }));
  const scored=scoreCorroborationResults(claim,results);
  assert.equal(scored.independentDomains,3);
  assert.equal(scored.articleBackedDomains,0);
  assert.equal(scored.status,'LIMITED');
  assert.equal(scored.matches[0].evidenceLevel,'headline_only');
});

test('three independent article bodies with claim-term coverage can be corroborated', () => {
  const claim='Central Bank raises emergency interest rates after inflation surge';
  const body='The Central Bank raised emergency interest rates after inflation surged, according to the official monetary policy statement.';
  const results=['alpha.com','beta.org','gamma.net'].map((host,i)=>({
    title:[
      'Central Bank raises emergency interest rates after inflation surge',
      'Central Bank hikes emergency interest rates amid inflation surge',
      'Emergency interest rate increase by Central Bank as inflation surges'
    ][i],url:`https://${host}/story`,source:host,articleText:body,
    provenance:{sha256:'a'.repeat(64),capturedAt:1700000000000,url:`https://${host}/story`}
  }));
  const scored=scoreCorroborationResults(claim,results);
  assert.equal(scored.articleBackedDomains,3);
  assert.equal(scored.status,'CORROBORATED');
  assert.equal(scored.matches[0].evidenceLevel,'article_body');
  assert.equal(scored.matches[0].evidenceHash,'a'.repeat(64));
});

test('Google News aggregator URLs retain publisher identities from source labels', () => {
  const claim='Central Bank raises emergency interest rates after inflation surge';
  const results=[
    {title:'Central Bank raises emergency interest rates after inflation surge',url:'https://news.google.com/rss/articles/one',source:'The Hindu'},
    {title:'Central Bank hikes emergency interest rates amid inflation surge',url:'https://news.google.com/rss/articles/two',source:'BBC News'},
    {title:'Emergency interest rate increase by Central Bank as inflation surges',url:'https://news.google.com/rss/articles/three',source:'Reuters'}
  ];
  const scored=scoreCorroborationResults(claim,results);
  assert.equal(scored.independentDomains,3);
});

test('controlled DNS blocks mixed public and private answers', async () => {
  await assert.rejects(resolvePublicTarget('http://mixed.test',async()=>[
    {address:'8.8.8.8',family:4},{address:'127.0.0.1',family:4}
  ]),/not on the public internet/);
});

test('controlled DNS blocks private destinations before opening a socket', async () => {
  await assert.rejects(safeFetch('http://private.test',{},0,async()=>[
    {address:'10.0.0.8',family:4}
  ]),/not on the public internet/);
});

test('redirect targets are re-resolved and private redirect destinations are blocked', async () => {
  const fakeRequest=(_url,_options,callback)=>({
    setTimeout(){},on(){return this;},write(){},
    end(){const response=Readable.from([]);response.statusCode=302;response.statusMessage='Found';response.headers={location:'http://metadata.test/latest'};callback(response);}
  });
  const resolver=async host=>host==='public.test'
    ? [{address:'8.8.8.8',family:4}]
    : [{address:'169.254.169.254',family:4}];
  await assert.rejects(safeFetch('http://public.test/start',{},0,resolver,fakeRequest),/not on the public internet/);
});
