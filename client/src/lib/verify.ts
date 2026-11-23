// Imagery-verification helpers (pure, keyless). Reverse-image search launchers
// and free-satellite viewers for change detection / geolocation. No secrets.

export const reverseImageLinks = (imageUrl: string) => {
  const u = encodeURIComponent(imageUrl);
  return [
    { name: 'Google Lens', url: `https://lens.google.com/uploadbyurl?url=${u}` },
    { name: 'Yandex', url: `https://yandex.com/images/search?rpt=imageview&url=${u}` },
    { name: 'Bing', url: `https://www.bing.com/images/search?view=detailv2&iss=sbi&q=imgurl:${u}` },
    { name: 'TinEye', url: `https://tineye.com/search?url=${u}` },
  ];
};

export const satelliteViewers = (lat: number, lng: number, date?: string) => {
  const d = (date || '').trim();
  const bb = (n: number, d2: number) => (n + d2).toFixed(4);
  return [
    { name: 'NASA Worldview', url: `https://worldview.earthdata.nasa.gov/?v=${bb(lng, -2)},${bb(lat, -2)},${bb(lng, 2)},${bb(lat, 2)}${d ? `&t=${d}` : ''}` },
    { name: 'Sentinel EO Browser', url: `https://apps.sentinel-hub.com/eo-browser/?lat=${lat}&lng=${lng}&zoom=12${d ? `&time=${d}` : ''}` },
    { name: 'Esri Wayback', url: `https://livingatlas.arcgis.com/wayback/#active=&mapCenter=${lng}%2C${lat}%2C14` },
    { name: 'Zoom Earth', url: `https://zoom.earth/#view=${lat},${lng},13z${d ? `/date=${d}` : ''}` },
    { name: 'Google Earth', url: `https://earth.google.com/web/@${lat},${lng},1000a,6000d` },
  ];
};
