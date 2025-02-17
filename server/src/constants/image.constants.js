export const SUPPORTED_FORMATS = [".jpg", ".jpeg", ".png", ".webp", ".tiff"];
export const BASE_PROMPT = `Generate SEO friendly title, description, and keywords(single word) as a JSON object for the following image. Only return the JSON. Do not include any other text.
{
    "title": "generated title",
    "description": "generated description",
    "keywords": ["keyword1", "keyword2", ...]
    }
    `;
export const PROMPT = `Please give me a long perfect title of about 90 characters, description of about 120 characters and as realeted 45 single SEO keywords based on the Microstock site and follow (Anatomy of Titles: Style, Subject, Location or background) about this image, don't use (:,&, |) symbols in title and description;
    
Do not use these keywords in any titles, descriptions, and keywords`;

export const FORBIDDEN_KEYWORDS = [
  "thanksgiving",
  "valentine",
  "vintage",
  "heaven",
  "heavenly",
  "retro",
  "god",
  "love",
  "valentines",
  "paradise",
  "majestic",
  "magic",
  "rejuvenating",
  "habitat",
  "pristine",
  "revival",
  "residence",
  "primitive",
  "zen",
  "graceful",
  "fashion",
  "cinema",
  "movie",
  "club",
  "bar",
  "matrix",
  "nightlife",
  "fantasy",
  "sci-fi",
  "romantic",
  "wedding",
  "party",
  "Christmas",
  "celebration",
  "easter",
  "winery",
  "wine",
  "spooky",
  "majestic",
  "pork",
  "kaleidoscopic",
  "mandala",
  "bohemian",
  "ethnic",
  "folk",
  "fairy tale",
  "story",
  "celestial",
  "minimalistic",
];
