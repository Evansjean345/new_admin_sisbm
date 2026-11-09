import packageJson from "../../package.json";

const currentYear = new Date().getFullYear();

export const APP_CONFIG = {
  name: "SISBM CORE",
  version: packageJson.version,
  copyright: `© ${currentYear}, SISBM CORE.`,
  /** Organisation de l'exploitant : ses comptes sont les « utilisateurs SISBM » (§VI.2, écran 1). */
  platformOrganizationCode: "sisbm",
  meta: {
    title: "SISBM CORE - Administration",
    description: "Plateforme d'administration SISBM CORE : supervision de flotte, trackers GPS et canaux flespi.",
  },
};
