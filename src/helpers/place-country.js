function countryCodeFromPlace(place) {
  const components =
    place && (place.address_components || place.addressComponents);
  if (!Array.isArray(components)) return null;
  const country = components.find(
    component =>
      Array.isArray(component.types) && component.types.includes('country')
  );
  const shortName = country && (country.short_name || country.shortText);
  return shortName
    ? String(shortName)
        .trim()
        .toUpperCase()
    : null;
}

module.exports = { countryCodeFromPlace };
