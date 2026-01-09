(() => {
  const textoNumero = t =>
    t ? parseInt(t.replace(/\D/g, ''), 10) : null;

  const getText = sel =>
    document.querySelector(sel)?.innerText.trim() ?? null;

  const url = location.href;
  const id = url.split('/').slice(-2).join('/');

  const section = document.querySelector(
    '#main-content > section:nth-child(2) > div'
  );

  let featuresBlock = null;

  if (section) {
    const title = section.querySelector('h2')?.innerText.trim() ?? null;
    const list = section.querySelector('[data-testid="featuresList"]');

    const features = list
      ? [...list.querySelectorAll('.re-DetailFeaturesList-feature')]
          .map(item => {
            const label =
              item.querySelector('.re-DetailFeaturesList-featureLabel')
                ?.innerText.trim() ?? null;

            const value =
              item.querySelector('.re-DetailFeaturesList-featureValue')
                ?.innerText.trim() ?? null;

            if (!label || !value) return null;
            return { label, value };
          })
          .filter(Boolean)
      : [];

    featuresBlock = { title, features };
  }

  const extras = (() => {
    const ul = document.querySelector(
      '#main-content > section:nth-child(2) > div > div > div.re-DetailExtras > ul'
    );
    if (!ul) return [];
    return [...ul.querySelectorAll('li')]
      .map(li => li.innerText.trim())
      .filter(Boolean);
  })();

  const ubicacion = (() => {
    const h2s = [...document.querySelectorAll('#main-content h2')];
    for (const h2 of h2s) {
      const text = h2.innerText.trim();
      if (
        text.length > 5 &&
        !/características|descripción|precio|extras/i.test(text)
      ) {
        return text;
      }
    }
    return null;
  })();

  return {
    id,
    url,
    precio: textoNumero(getText('.re-DetailHeader-price')),
    titulo: getText('.re-DetailHeader-propertyTitle'),
    municipio: getText('.re-DetailHeader-municipalityTitle'),
    descripcion: getText('.re-DetailDescription'),
    habitaciones: textoNumero(
      getText('.re-DetailHeader-rooms span:nth-child(2)')
    ),
    banos: textoNumero(
      getText('.re-DetailHeader-bathrooms span:nth-child(2)')
    ),
    metros: textoNumero(
      getText('.re-DetailHeader-surface span:nth-child(2)')
    ),
    planta: getText(
      '.re-DetailHeader-featuresItem.floor span:nth-child(2)'
    ),
    featuresBlock,
    extras,
    ubicacion,
    timestamp: new Date().toISOString()
  };
})();
