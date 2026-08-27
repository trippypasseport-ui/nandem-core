import React, { useState, useRef, useEffect } from "react";
import {
  Send, Loader2, Copy, ChevronRight, ChevronLeft, Sparkles, Plus,
  FolderOpen, Library, Trash2, Check, Download, Wand2, Mail, Link2,
  FileText, Image as ImageIcon, MessageSquare, Building2, ChevronDown,
  Settings as SettingsIcon, HelpCircle, History, Users, Receipt, TrendingUp,
  Lock, Pencil, Sun, Moon, FileCode,
} from "lucide-react";
// Onglets d'une fiche projet qui restent visibles mais verrouillés tant que
// la synthèse du diagnostic n'existe pas — ajouté après une revue
// d'intuitivité réelle du 27/08/2026 : l'utilisateur ne découvrait le
// verrouillage qu'après avoir cliqué sur l'onglet, jamais avant.
const LOCKED_WITHOUT_SYNTHESIS_TABS = new Set(["conception", "realisation"]);

// ---------------------------------------------------------------------------
// NANDĒM Core — V1.5 (hypothèse, non scellé)
// Ajout : onboarding revisitable (pattern déjà validé sur L'Œil), Réglages
// avec studioName/feedbackEmail éditables (remplace les placeholders codés
// en dur) — stockés en PARTAGÉ car visibles par les clients via ?client=1.
//
// CORRECTIF (04/08/2026) : le lien client (ClientDiscoveryShell) reposait
// uniquement sur mailto: pour transmettre le diagnostic, avec un
// setSent(true) affiché quoi qu'il arrive. Testé en conditions réelles avec
// un tiers : aucun mail reçu — mailto: ne fonctionne que si l'appareil a un
// client mail par défaut configuré, ce qui n'est pas garanti. Correctif :
// ne plus affirmer un envoi qu'on ne peut pas vérifier, et toujours proposer
// une solution de secours (copier le texte) qui ne dépend d'aucune appli
// tierce — même logique que le fallback déjà utilisé ailleurs dans ce
// fichier pour le presse-papier.
// ---------------------------------------------------------------------------

const PLACEHOLDER_EMAIL = "trippy.passeport@gmail.com";
const PLACEHOLDER_STUDIO = "NANDĒM Services";
const PROJECTS_PAGE_SIZE = 50;
const MAX_PATTERN_LIBRARY_ENTRIES = 200;

function genId() {
  try { if (crypto?.randomUUID) return crypto.randomUUID(); } catch {}
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

const ONBOARDING_STEPS = [
  { title: "Bienvenue dans NANDĒM Core", text: "Un outil pour transformer un besoin en projet clair, jusqu'à un dossier de construction utilisable avec l’agent ou la technologie de ton choix." },
  { title: "Discovery pose les questions", text: "Une seule à la fois, choisie par un algorithme selon son importance — jamais l'IA qui décide quoi demander. Si ta réponse est floue, elle relance une seule fois." },
  { title: "Chaque diagnostic devient un projet", text: "Statut, entreprise, documents, conversation brute — tout reste attaché, consultable, exportable à tout moment." },
  { title: "Optimisation, c'est toi qui décides", text: "Rien n'y entre automatiquement. Tu choisis quoi garder, à quel niveau de généricité, jamais le moteur seul." },
  { title: "Un lien pour tes clients", text: "Depuis Projets, 'Lien client' copie une URL qui n'ouvre que le Discovery — ton client ne voit jamais tes autres projets." },
];

// Questions communes aux deux questionnaires — même formulation, même rôle
// sécurité/technique quel que soit le type de projet (société ou application).
const Q_ACTIVITE = { id: "activite", label: "Le projet", importance: 5, cost: 1, dependsOn: [],
  question: "Raconte-moi ton projet — comme tu le ferais à un designer, tout ce que tu as déjà en tête compte, même en vrac. Je trie et je ne redemande que ce qu'il manque." };
const Q_SECTEUR = { id: "secteur", label: "Secteur sensible", importance: 5, cost: 1, dependsOn: ["activite"],
  question: "Ce projet touche-t-il un domaine sensible : santé, juridique, protection de l'enfance, argent/finance, ou service public ? Précise, ou dis simplement \"aucun\"." };
const Q_AMBIANCE = { id: "ambiance", label: "Ambiance visuelle", importance: 3, cost: 1, dependsOn: ["activite"],
  question: "Quelles couleurs ou ambiances te parlent pour ce projet ? Pas besoin de codes précis — \"sobre et pro\", \"chaleureux\", \"ça me fait penser à la mer\"..." };
const Q_STACK = { id: "stack", label: "Stack technique", importance: 4, cost: 1, dependsOn: ["activite"],
  question: "Une préférence technique à respecter ? (langage/framework, vraie base de données ou pas encore besoin, projet neuf ou existant à reprendre). Dis \"aucune préférence, à toi de choisir\" si tu ne sais pas — cette réponse est transmise telle quelle dans le dossier de construction, sans reformulation." };
const Q_PRIORITE = { id: "priorite", label: "Priorité n°1", importance: 5, cost: 1, dependsOn: ["frustration"],
  question: "Si une seule chose devait être résolue en premier, ce serait laquelle ?" };

// Questionnaire SOCIÉTÉ — logique métier/entreprise : processus existant,
// outils actuels, informations à suivre. Un besoin de gestion/organisation.
const GOALS_ENTREPRISE = [
  Q_ACTIVITE,
  Q_SECTEUR,
  { id: "utilisateurs", label: "Utilisateurs", importance: 5, cost: 1, dependsOn: ["activite"],
    question: "Qui utilisera ça au quotidien ? Toi seul, quelqu'un en particulier, plusieurs personnes ?" },
  { id: "probleme", label: "Problème réel", importance: 5, cost: 2, dependsOn: ["activite"],
    question: "Quel est le problème concret que ça doit résoudre ? Un exemple récent m'aide beaucoup." },
  { id: "processus", label: "Comment ça se passe aujourd'hui", importance: 4, cost: 3, dependsOn: ["probleme"],
    question: "Comment ça se passe aujourd'hui, concrètement, sans l'application ?" },
  { id: "outils", label: "Outils actuels", importance: 3, cost: 1, dependsOn: ["processus"],
    question: "Avec quoi c'est géré en ce moment : papier, une appli existante, rien du tout ?" },
  { id: "donnees", label: "Informations à suivre", importance: 4, cost: 2, dependsOn: ["processus"],
    question: "Quelles informations faut-il suivre ou retrouver le plus souvent ?" },
  { id: "contraintes", label: "Contraintes", importance: 3, cost: 2, dependsOn: ["activite"],
    question: "Des contraintes à connaître : budget, délai, réglementation propre au secteur, accès internet incertain ?" },
  { id: "frustration", label: "Frustration principale", importance: 4, cost: 2, dependsOn: ["probleme"],
    question: "Qu'est-ce qui pose le plus de souci aujourd'hui dans tout ça, très concrètement ?" },
  Q_PRIORITE,
  Q_AMBIANCE,
  Q_STACK,
];

// Questionnaire APPLICATION — logique produit grand public : audience,
// interaction entre utilisateurs, plateforme, acquisition, monétisation,
// données personnelles. N'a rien à voir avec un outil de gestion interne
// (ex. une appli de lien social ≠ une appli de gestion de société).
const GOALS_APP = [
  Q_ACTIVITE,
  Q_SECTEUR,
  { id: "utilisateurs", label: "Public visé", importance: 5, cost: 2, dependsOn: ["activite"],
    question: "Qui est censé utiliser cette application, et pourquoi voudrait-il l'ouvrir plutôt qu'autre chose ? (ex. rester en contact avec des proches, trouver des gens qui partagent un centre d'intérêt, se motiver ensemble...)" },
  { id: "interactionSociale", label: "Interaction entre utilisateurs", importance: 5, cost: 2, dependsOn: ["activite"],
    question: "Comment les utilisateurs interagissent-ils entre eux dans l'appli — messages, publications, groupes, mise en relation, autre chose ? Ou l'usage reste-t-il solo, sans lien entre utilisateurs ?" },
  { id: "plateforme", label: "Plateforme cible", importance: 4, cost: 1, dependsOn: ["activite"],
    question: "L'appli doit-elle fonctionner sur mobile (iOS/Android), sur navigateur web, ou les deux ? Un choix déjà fait, ou encore ouvert ?" },
  { id: "donneesPerso", label: "Données personnelles manipulées", importance: 5, cost: 2, dependsOn: ["activite"],
    question: "Quelles informations personnelles ou sensibles des utilisateurs l'appli va-t-elle manipuler : photos, localisation, messages privés, contacts, autre ?" },
  { id: "acquisition", label: "Premiers utilisateurs", importance: 4, cost: 2, dependsOn: ["utilisateurs"],
    question: "Comment les premiers utilisateurs vont-ils découvrir et rejoindre l'appli ? (bouche-à-oreille, réseaux sociaux, une communauté déjà existante, autre chose)" },
  { id: "monetisation", label: "Modèle économique", importance: 3, cost: 1, dependsOn: ["activite"],
    question: "Comment l'appli doit-elle, ou pourrait-elle un jour, générer un revenu : gratuite pour l'instant, abonnement, publicité, achat intégré, pas encore réfléchi ?" },
  { id: "frustration", label: "Frustration principale", importance: 4, cost: 2, dependsOn: ["activite"],
    question: "Dans les applications similaires que tu connais déjà, qu'est-ce qui te frustre le plus aujourd'hui ?" },
  Q_PRIORITE,
  Q_AMBIANCE,
  Q_STACK,
];

// "Laboratoire"/"Interne" restent groupés avec App (déjà le cas ailleurs dans
// ce fichier pour l'affichage) — projets non commerciaux, pas de logique
// métier/société à leur poser.
function getGoalsFor(categorie) {
  return (categorie === "App" || categorie === "Laboratoire" || categorie === "Interne") ? GOALS_APP : GOALS_ENTREPRISE;
}
function questionnaireFamily(categorie) {
  return (categorie === "App" || categorie === "Laboratoire" || categorie === "Interne") ? "app" : "entreprise";
}
function applyQuestionOverrides(goals, categorie, overrides = []) {
  const family = questionnaireFamily(categorie);
  return goals.map((goal) => {
    const override = overrides.find((item) => item.goalId === goal.id && (item.questionnaire === family || item.questionnaire === "tous"));
    return override ? { ...goal, question: override.question, questionOverrideVersion: override.version } : goal;
  });
}
function sanitizeQuestionnaireText(value) {
  return String(value || "").replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email masqué]").replace(/(?:\+33|0)[1-9](?:[ .-]?\d{2}){4}/g, "[téléphone masqué]").replace(/https?:\/\/\S+/gi, "[lien masqué]").slice(0, 1200);
}

// Questions supplémentaires déclenchées UNIQUEMENT si la réponse à "secteur"
// mentionne un domaine sensible — jamais posées sinon. Détection par mots-clés,
// pas d'appel IA supplémentaire (coût nul, conforme à la philosophie Discovery :
// l'IA n'intervient que sur la relance et la synthèse finale).
const SECTOR_KEYWORDS = {
  sante: ["santé", "médical", "médecin", "patient", "thérap", "clinique", "infirmi", "pharma", "soin"],
  juridique: ["avocat", "juridique", "droit", "notaire", "huissier", "contentieux"],
  enfance: ["enfant", "mineur", "école", "crèche", "garderie", "ado", "jeunesse", "scolaire"],
  finance: ["argent", "finance", "banque", "paiement", "crédit", "prêt", "investissement", "bourse", "crypto"],
  public: ["mairie", "administration", "service public", "collectivité", "préfecture"],
};
const SECTOR_EXTRA_GOALS = {
  sante: { id: "extra_sante", label: "Confidentialité santé", importance: 5, cost: 1, dependsOn: ["secteur"],
    question: "Vu le secteur santé : comment les données des patients doivent-elles être protégées ? Un hébergement de données de santé (HDS) est-il déjà identifié comme obligatoire ?" },
  juridique: { id: "extra_juridique", label: "Secret professionnel", importance: 5, cost: 1, dependsOn: ["secteur"],
    question: "Le secret professionnel s'applique-t-il aux informations traitées ? Faut-il un accès strictement limité par dossier ou par client ?" },
  enfance: { id: "extra_enfance", label: "Sécurité des mineurs", importance: 5, cost: 1, dependsOn: ["secteur"],
    question: "Des mineurs utiliseront-ils l'application directement, ou seulement des adultes responsables ? Faut-il une autorisation parentale ou des accès séparés parent/enfant ?" },
  finance: { id: "extra_finance", label: "Réglementation financière", importance: 5, cost: 1, dependsOn: ["secteur"],
    question: "Y a-t-il de vrais fonds réellement déplacés, ou juste un suivi/une simulation ? Un cadre réglementaire (ex. KYC, DSP2) est-il déjà identifié ?" },
  public: { id: "extra_public", label: "Accessibilité", importance: 5, cost: 1, dependsOn: ["secteur"],
    question: "Le service s'adresse-t-il au grand public ou à des administrés ? Une obligation d'accessibilité (RGAA) est-elle déjà connue ?" },
};
function detectSectors(text) {
  const t = text.toLowerCase();
  return Object.keys(SECTOR_KEYWORDS).filter((key) => SECTOR_KEYWORDS[key].some((kw) => t.includes(kw)));
}

// Bibliothèque de détecteurs — chaque entrée correspond à une contrainte déjà
// validée (statut Établi) dans le skill nandem-app-builder. Objectif : ne plus
// dépendre uniquement de la mémoire de l'IA de synthèse pour les faire
// apparaître dans le prompt Claude Code. Toujours étiquetées comme Method
// détectée automatiquement, jamais présentées comme une invention du moteur —
// à vérifier par la personne, pas à appliquer aveuglément (principe 12,
// NANDEM-METHOD-V0 : provenance des connaissances).
const METHOD_CONSTRAINT_LIBRARY = [
  { id: "financier", keywords: ["vente", "paiement", "facture", "transaction", "montant", "prix", "caisse", "encaissement", "commande"],
    text: "Financier : figer chaque montant réel au moment de la transaction (snapshot sur l'enregistrement), jamais recalculé depuis un prix courant modifiable — sinon un changement de prix ultérieur réécrit silencieusement l'historique." },
  { id: "stock-cycles", keywords: ["stock", "inventaire", "ressource", "approvisionnement", "ingrédient"],
    text: "Stock/inventaire à cycles répétés : marquer un point de départ (index/horodatage) à chaque remplissage, calculer la consommation seulement depuis ce marqueur — jamais depuis le début complet de l'historique." },
  { id: "panier", keywords: ["panier", "en cours", "réservation", "file d'attente"],
    text: "Disponibilité : inclure les éléments déjà engagés mais non encore confirmés (panier en cours) dans le calcul, pas seulement l'historique déjà validé." },
  { id: "etats", keywords: ["ouvert", "fermé", "actif", "inactif", "statut", "état des lieux"],
    text: "Changements d'état importants (ouvert/fermé, actif/inactif) : toujours une action explicite et visible, jamais un effet de bord d'une autre action." },
  { id: "alertes", keywords: ["alerte", "notification", "rappel", "seuil"],
    text: "Alertes : distinguer alerte opérationnelle (pertinente seulement pendant l'activité) et alerte sécurité/conformité (reste active en continu)." },
  { id: "securite-mdp", keywords: ["mot de passe", "authentification", "connexion", "rôle", "accès restreint"],
    text: "Sécurité : un mot de passe vérifié côté client (state/localStorage) est une dissuasion d'écran, jamais une vraie protection — le dire explicitement dans l'interface, jamais le présenter comme une sécurité forte." },
  { id: "notif-multi", keywords: ["plusieurs appareils", "multi-appareil", "à distance", "suivi à distance"],
    text: "Notifications : un artifact/frontend seul ne peut notifier que l'appareil de la session en cours — pas de notification multi-appareils réelle sans backend et service push partagé." },
  { id: "exemple-concret", keywords: ["ratio", "taux", "conversion"],
    text: "Ne jamais demander une valeur abstraite déjà calculée : demander un exemple concret connu de l'utilisateur et calculer le taux automatiquement à partir de cet exemple." },
];

const UNIVERSAL_QUALITY_CHARTER = {
  title: "Exigence NANDĒM — excellence utile",
  principle: "Construis la meilleure version réaliste de cette application dans le périmètre validé. Recherche simultanément utilité, simplicité, beauté, cohérence, fiabilité et performance. Chaque décision doit servir l’utilisateur réel. N’ajoute aucune complexité uniquement pour impressionner. Une excellente application n’est pas celle qui possède le plus de fonctionnalités, mais celle dont chaque élément est utile, compréhensible et parfaitement exécuté.",
  rules: [
    "Donner au produit une identité visuelle propre à son activité et à ses utilisateurs ; éviter l’interface générique qui pourrait appartenir à n’importe quelle application.",
    "Justifier chaque fonctionnalité par un besoin réel ; retirer ou reporter ce qui n’améliore pas clairement l’usage.",
    "Concevoir le thème clair, sombre ou automatique seulement s’il est pertinent pour le contexte d’usage, avec contraste et lisibilité vérifiés.",
    "Optimiser la fluidité sur les appareils et réseaux réellement visés ; éviter les dépendances, animations et calculs sans bénéfice mesurable.",
    "Traiter explicitement les états vide, chargement, erreur, hors-ligne si pertinent, permissions refusées, double action et reprise après interruption.",
    "Préserver la simplicité : vocabulaire clair, actions importantes visibles, navigation prévisible et aucune complexité décorative.",
  ],
  acceptance: [
    "Le besoin principal est réellement résolu de bout en bout.",
    "Une personne extérieure comprend rapidement quoi faire et pourquoi.",
    "L’identité visuelle correspond au métier, au public et à l’émotion recherchée.",
    "Chaque fonctionnalité présente est utile dans la version demandée.",
    "Les états difficiles et les erreurs prévisibles ont un comportement compréhensible.",
    "Les parcours principaux sont testés sur l’appareil cible.",
    "Le résultat ne donne pas l’impression d’un prototype générique généré automatiquement.",
  ],
};

const UNIVERSAL_BUILD_WORKFLOW = [
  { id: "beta", title: "Version bêta à valider", instruction: "Construis d’abord les écrans et flux principaux dans une version cohérente et fonctionnelle. Arrête-toi ensuite pour présenter ce qui fonctionne, les choix effectués et ce qui reste à consolider. Attends une validation explicite avant la suite." },
  { id: "complete", title: "Version complète", instruction: "Après validation, complète les cas limites, la robustesse, l’accessibilité pertinente et la préparation au déploiement réel. Vérifie la charte qualité et tous les critères d’acceptation avant de conclure." },
];

// Candidats révélés par la simulation isolée de 200 projets (40 par canal
// d'entrée). Des données fictives ne prouvent pas une universalité : ces
// éléments sont donc des contrôles de pertinence obligatoires, jamais des
// fonctionnalités injectées aveuglément.
const DEFAULT_RELEVANCE_CHECKS = [
  { id: "historique-fige", label: "Historique immuable et traçable", question: "Le projet contient-il des faits historiques (transaction, décision, statut passé) qui doivent rester figés malgré les changements futurs ?" },
  { id: "recherche-filtre", label: "Recherche et filtres adaptés au volume", question: "Le volume réaliste rendra-t-il nécessaire une recherche, un tri ou des filtres réellement utiles ?" },
  { id: "accessibilite", label: "Lisibilité et accessibilité adaptées au public", question: "Quels besoins de contraste, taille, clavier, lecteur d’écran ou simplicité découlent du public réel ?" },
  { id: "export", label: "Export et portabilité des données", question: "L’utilisateur doit-il récupérer, sauvegarder ou transférer ses données sans dépendre de l’outil ?" },
  { id: "confidentialite", label: "Confidentialité proportionnée aux données", question: "Les données manipulées exigent-elles minimisation, permissions, effacement, chiffrement ou hébergement particulier ?" },
  { id: "etats-difficiles", label: "États vide, chargement, erreur et reprise", question: "Quels états difficiles sont possibles et comment l’utilisateur comprend-il ce qui se passe et reprend-il son action ?" },
  { id: "notifications-contextuelles", label: "Notifications utiles et contextuelles", question: "Une notification sert-elle une action réelle, au bon moment, sans bruit ni promesse multi-appareils impossible ?" },
  { id: "hors-ligne", label: "Continuité en réseau incertain", question: "Le réseau peut-il être faible ou absent dans l’usage cible, et quelles actions doivent alors rester possibles ?" },
  { id: "autosauvegarde", label: "Sauvegarde et reprise sans perte", question: "Une saisie ou un parcours interrompu doit-il pouvoir être repris sans perte ni double action ?" },
  { id: "performance", label: "Performance sur l’appareil cible", question: "Quelles limites de matériel, réseau et volume doivent être testées pour garantir une sensation fluide ?" },
  { id: "roles-permissions", label: "Rôles et permissions compréhensibles", question: "Plusieurs profils ont-ils des droits différents, et chaque refus ou limite d’accès est-il compréhensible ?" },
  { id: "onboarding", label: "Prise en main progressive", question: "Un nouvel utilisateur comprend-il la valeur et la première action sans tutoriel lourd ?" },
  { id: "theme-contextuel", label: "Direction visuelle propre au contexte", question: "L’identité, les couleurs et le mode clair ou sombre correspondent-ils réellement au métier, au public et au contexte d’usage ?" },
  { id: "moderation", label: "Modération et signalement", question: "Le contenu ou les interactions entre utilisateurs nécessitent-ils signalement, blocage, règles et traitement des abus ?" },
  { id: "etats-explicites", label: "Actions d’état explicites", question: "Les transitions importantes sont-elles déclenchées par une action visible plutôt que par un effet de bord ?" },
  { id: "validation-saisie", label: "Validation des saisies", question: "Chaque saisie invalide explique-t-elle le problème et sa correction sans perdre les données ?" },
  { id: "criteres-acceptation", label: "Critères d’acceptation vérifiables", question: "Chaque fonctionnalité importante possède-t-elle un résultat observable permettant de la déclarer conforme ?" },
  { id: "observabilite", label: "Erreurs observables et diagnostic", question: "Les erreurs importantes laissent-elles un diagnostic exploitable sans exposer de données sensibles ?" },
  { id: "collaboration-conflits", label: "Collaboration et conflits", question: "Plusieurs personnes peuvent-elles modifier les mêmes données, et comment les conflits sont-ils résolus ?" },
  { id: "journal-audit", label: "Journal d’audit", question: "Faut-il savoir qui a réalisé une action importante, quand et sur quelle donnée ?" },
  { id: "responsive", label: "Interface responsive", question: "Les parcours essentiels restent-ils utilisables sur tous les appareils réellement ciblés ?" },
  { id: "consentement-retention", label: "Consentement et conservation", question: "Quelles données exigent un consentement et combien de temps doivent-elles être conservées ?" },
  { id: "suppression-export-compte", label: "Export et suppression du compte", question: "L’utilisateur peut-il récupérer puis supprimer réellement son compte et ses données ?" },
  { id: "sauvegarde-versionnee", label: "Sauvegardes versionnées", question: "Une sauvegarde antérieure peut-elle être restaurée et cette restauration est-elle testée ?" },
  { id: "annulation-restauration", label: "Annulation et restauration", question: "Une action sensible ou destructive peut-elle être annulée ou récupérée ?" },
  { id: "pagination-volume", label: "Pagination des grands volumes", question: "Le volume réaliste nécessite-t-il pagination, chargement progressif ou virtualisation ?" },
  { id: "actions-lot", label: "Actions en lot", question: "Des opérations répétitives doivent-elles être regroupées avec aperçu, confirmation et compte rendu ?" },
  { id: "import-portable", label: "Import contrôlé", question: "Des données externes doivent-elles être importées avec validation et aperçu des erreurs ?" },
  { id: "idempotence", label: "Prévention des doublons", question: "Un double clic ou une reprise réseau risque-t-il de répéter une opération ?" },
  { id: "multi-tenant", label: "Séparation des organisations", question: "Plusieurs organisations exigent-elles une séparation stricte de leurs données et réglages ?" },
  { id: "limitation-abus", label: "Prévention des abus", question: "Un espace public exige-t-il quotas, blocage, signalement ou limitation de fréquence ?" },
  { id: "synchronisation", label: "Synchronisation entre appareils", question: "Comment les modifications concurrentes ou hors ligne sont-elles synchronisées sans perte ?" },
  { id: "degradation-progressive", label: "Mode dégradé", question: "Quelles fonctions essentielles doivent rester disponibles lorsqu’un service ou le réseau manque ?" },
  { id: "brouillons", label: "Brouillons automatiques", question: "Une saisie longue ou interrompue doit-elle être conservée avant validation ?" },
  { id: "localisation-fuseaux", label: "Langues et fuseaux horaires", question: "Le projet doit-il gérer plusieurs langues, formats locaux, devises ou fuseaux horaires ?" },
];
const SIMULATION_200_BASELINE = [
  { id: "recherche-filtre", frequency: 0.40, signals: ["recherche", "filtre", "catalogue", "liste", "volume"] },
  { id: "accessibilite", frequency: 0.40, signals: ["accessibil", "public", "senior", "handicap", "lisibil"] },
  { id: "export", frequency: 0.35, signals: ["export", "csv", "pdf", "sauvegarde", "transfert"] },
  { id: "historique-fige", frequency: 0.30, signals: ["historique", "transaction", "prix", "vente", "statut"] },
  { id: "notifications-contextuelles", frequency: 0.30, signals: ["notification", "rappel", "alerte", "échéance"] },
  { id: "performance", frequency: 0.30, signals: ["performance", "rapide", "mobile", "volume"] },
  { id: "autosauvegarde", frequency: 0.25, signals: ["autosauvegarde", "brouillon", "reprendre", "saisie"] },
  { id: "confidentialite", frequency: 0.25, signals: ["confident", "personnel", "santé", "juridique", "privé"] },
  { id: "etats-difficiles", frequency: 0.25, signals: ["erreur", "chargement", "hors ligne", "reprise"] },
  { id: "hors-ligne", frequency: 0.20, signals: ["hors ligne", "réseau", "terrain", "mobilité"] },
  { id: "roles-permissions", frequency: 0.30, signals: ["rôle", "permission", "administrateur", "équipe", "accès"] },
  { id: "onboarding", frequency: 0.25, signals: ["onboarding", "première utilisation", "débutant", "prise en main"] },
  { id: "theme-contextuel", frequency: 0.20, signals: ["thème", "sombre", "clair", "couleur", "ambiance"] },
  { id: "moderation", frequency: 0.15, signals: ["modération", "signaler", "signalement", "abus", "communauté", "contenu"] },
  { id: "etats-explicites", frequency: 0.10, signals: ["ouvrir", "fermer", "valider", "annuler", "statut"] },
  { id: "validation-saisie", frequency: 1, sampleSize: 10000, signals: ["formulaire", "saisie", "champ", "validation", "erreur"] },
  { id: "criteres-acceptation", frequency: 1, sampleSize: 10000, signals: ["fonctionnalité", "parcours", "résultat", "test", "validation"] },
  { id: "observabilite", frequency: 1, sampleSize: 10000, signals: ["erreur", "incident", "journal", "diagnostic", "support"] },
  { id: "collaboration-conflits", frequency: 0.75, sampleSize: 10000, signals: ["équipe", "collaboration", "plusieurs", "partagé", "conflit"] },
  { id: "journal-audit", frequency: 0.75, sampleSize: 10000, signals: ["équipe", "action", "historique", "responsable", "audit"] },
  { id: "responsive", frequency: 0.667, sampleSize: 10000, signals: ["mobile", "ordinateur", "tablette", "web", "responsive"] },
  { id: "consentement-retention", frequency: 0.667, sampleSize: 10000, signals: ["personnel", "sensible", "consentement", "rgpd", "conservation"] },
  { id: "suppression-export-compte", frequency: 0.667, sampleSize: 10000, signals: ["compte", "personnel", "profil", "suppression", "rgpd"] },
  { id: "sauvegarde-versionnee", frequency: 0.5, sampleSize: 10000, signals: ["sauvegarde", "restauration", "durée", "historique", "version"] },
  { id: "annulation-restauration", frequency: 0.5, sampleSize: 10000, signals: ["supprimer", "annuler", "restaurer", "irréversible", "sensible"] },
  { id: "pagination-volume", frequency: 0.5, sampleSize: 10000, signals: ["volume", "liste", "catalogue", "milliers", "historique"] },
  { id: "actions-lot", frequency: 0.5, sampleSize: 10000, signals: ["volume", "plusieurs", "lot", "import", "répétitif"] },
  { id: "import-portable", frequency: 0.333, sampleSize: 10000, signals: ["import", "csv", "json", "migration", "existant"] },
  { id: "idempotence", frequency: 0.25, sampleSize: 10000, signals: ["paiement", "commande", "validation", "réessayer", "double"] },
  { id: "multi-tenant", frequency: 0.25, sampleSize: 10000, signals: ["organisation", "entreprise", "client", "tenant", "établissement"] },
  { id: "limitation-abus", frequency: 0.25, sampleSize: 10000, signals: ["public", "communauté", "api", "publication", "abus"] },
  { id: "synchronisation", frequency: 0.2, sampleSize: 10000, signals: ["hors ligne", "appareil", "synchronisation", "réseau", "terrain"] },
  { id: "degradation-progressive", frequency: 0.2, sampleSize: 10000, signals: ["hors ligne", "réseau", "service", "indisponible", "permission"] },
  { id: "brouillons", frequency: 0.2, sampleSize: 10000, signals: ["saisie", "formulaire", "long", "brouillon", "interruption"] },
  { id: "localisation-fuseaux", frequency: 0.143, sampleSize: 10000, signals: ["international", "langue", "devise", "fuseau", "pays"] },
];
const DEFAULT_ENGINE_SCOPE = {
  accessibilite: ["universel", "toute application"], performance: ["universel", "toute application"], "etats-difficiles": ["universel", "toute application"], "theme-contextuel": ["universel", "toute application"],
  moderation: ["famille", "application sociale ou contenu partagé"], onboarding: ["famille", "application destinée à de nouveaux utilisateurs"], "roles-permissions": ["famille", "outil multi-rôles"],
  "recherche-filtre": ["famille", "données ou listes volumineuses"], export: ["famille", "données à conserver ou transférer"], "historique-fige": ["famille", "transactions ou faits historiques"],
  "notifications-contextuelles": ["famille", "alertes et échéances"], "hors-ligne": ["famille", "mobilité ou réseau incertain"], autosauvegarde: ["famille", "saisie ou parcours long"], confidentialite: ["famille", "données personnelles ou sensibles"], "etats-explicites": ["famille", "cycles et statuts métier"],
  "validation-saisie": ["universel", "toute application avec saisie"], "criteres-acceptation": ["universel", "toute application"], observabilite: ["universel", "toute application"],
  "collaboration-conflits": ["famille", "travail à plusieurs"], "journal-audit": ["famille", "actions multi-utilisateurs ou sensibles"], responsive: ["famille", "plusieurs tailles d’écran"],
  "consentement-retention": ["famille", "données personnelles ou sensibles"], "suppression-export-compte": ["famille", "comptes et données personnelles"], "sauvegarde-versionnee": ["famille", "données durables ou critiques"],
  "annulation-restauration": ["famille", "actions sensibles ou destructives"], "pagination-volume": ["famille", "grands volumes"], "actions-lot": ["famille", "opérations répétitives"], "import-portable": ["famille", "migration ou données externes"],
  idempotence: ["famille", "transactions ou actions rejouables"], "multi-tenant": ["famille", "plusieurs organisations"], "limitation-abus": ["famille", "espace public ou fonctions automatisables"], synchronisation: ["famille", "plusieurs appareils ou réseau incertain"],
  "degradation-progressive": ["famille", "dépendances externes ou réseau incertain"], brouillons: ["famille", "saisie longue ou interrompue"], "localisation-fuseaux": ["famille", "usage international"],
};
// Second axe de portée (27/08/2026), demandé par le porteur : "entreprise /
// grand public / universel" en plus du niveau existant (universel/famille/
// secteur/spécifique). Les deux axes se combinent au lieu de s'écraser —
// `niveau` reste inchangé (ex. "famille"), `publicCible` précise en plus à
// quel type de projet ça s'adresse. Absent de la liste ci-dessous = universel
// (s'applique aussi bien à un outil d'entreprise qu'à une appli grand public).
const DEFAULT_PUBLIC_CIBLE = {
  moderation: "grand_public", "limitation-abus": "grand_public",
  "roles-permissions": "entreprise", "historique-fige": "entreprise", "etats-explicites": "entreprise",
  "collaboration-conflits": "entreprise", "journal-audit": "entreprise", "actions-lot": "entreprise",
  "import-portable": "entreprise", "multi-tenant": "entreprise",
};
const SIMULATION_DEFAULT_REQUIREMENTS = SIMULATION_200_BASELINE.map((baseline) => {
  const check = DEFAULT_RELEVANCE_CHECKS.find((item) => item.id === baseline.id);
  const [niveau, cible] = DEFAULT_ENGINE_SCOPE[baseline.id] || ["a_classer", ""];
  return {
    id: `default:${baseline.id}`, version: 1, label: check?.label || baseline.id, famille: baseline.sampleSize ? "moteur initial — simulation 10 000" : "socle initial — simulation 200",
    portee: { niveau, cible }, publicCible: DEFAULT_PUBLIC_CIBLE[baseline.id] || "universel", statut: "Prometteur", priorite: niveau === "universel" ? 4 : 3,
    declencheurs: baseline.signals, exclusions: baseline.id === "moderation" ? ["usage solo", "aucun contenu partagé"] : [],
    instruction: `Évaluer explicitement ce contrôle pour le projet : ${check?.question || baseline.id} L’implémenter seulement si le besoin réel le justifie et documenter la décision.`,
    questions: [check?.question || baseline.id], tests: [`La décision applicable/non applicable est justifiée pour « ${check?.label || baseline.id} ».`, "Si applicable, au moins un test observable vérifie le comportement attendu."],
    preuves: { projetsFictifs: Math.round(baseline.frequency * (baseline.sampleSize || 200)), projetsReels: 0, bugsConfirmes: 0, contreExemples: 0 },
    provenance: { type: "simulation", tailleEchantillon: baseline.sampleSize || 200, frequence: baseline.frequency, statut: "candidat fictif, à confirmer sur projets réels" },
    importedAt: "2026-08-05T00:00:00.000Z", lockedDefault: true,
  };
});
function guideV2Pattern(id, label, cible, declencheurs, exclusions, instruction, tests, incompatibilites = [], parametres = {}, publicCible = "universel") {
  return {
    id: `guide-v2:${id}`, version: 1, label, famille: "Guide V2 — UX et assemblage", portee: { niveau: "famille", cible }, publicCible,
    statut: "Hypothèse", priorite: 3, declencheurs, exclusions, instruction, questions: [`Ce pattern « ${label} » répond-il à l’intention principale et au contexte d’usage réel ?`], tests,
    incompatibilites, parametres, preuves: { projetsFictifs: 0, projetsReels: 0, bugsConfirmes: 0, contreExemples: 0 },
    provenance: { type: "apport-porteur", source: "Guide de génération d’applications V2.0", statut: "bibliothèque importée, à tester" },
    importedAt: "2026-08-05T00:00:00.000Z", lockedDefault: true,
  };
}
const GUIDE_V2_REQUIREMENTS = [
  guideV2Pattern("landing-page", "Landing page orientée conversion", "présentation ou acquisition", ["vitrine", "landing", "présentation", "acquisition", "service"], ["utilisateur connecté", "outil interne"], "Présenter la proposition de valeur immédiatement, avec une action principale et une hiérarchie courte.", ["La proposition de valeur est comprise rapidement.", "Une seule action principale domine visuellement."], ["dashboard-principal"], { ctaPrincipaux: 1, featuresIndicatives: "3 à 5" }),
  guideV2Pattern("dashboard-principal", "Dashboard de pilotage", "surveillance et navigation fréquente", ["dashboard", "pilotage", "kpi", "suivi", "analyse"], ["usage occasionnel", "simple vitrine"], "Organiser les indicateurs prioritaires, les actions et le détail selon la fréquence réelle de consultation.", ["Les indicateurs prioritaires apparaissent avant les détails.", "Chaque indicateur mène à une action ou une explication."], ["fullscreen-hero"], { profondeurNavigationMaxIndicative: 3 }, "entreprise"),
  guideV2Pattern("site-vitrine", "Site vitrine simple", "présentation institutionnelle ou portfolio", ["vitrine", "portfolio", "institutionnel", "présentation"], ["application métier connectée"], "Utiliser une navigation courte et linéaire sans structure d’application inutile.", ["Les contenus essentiels restent accessibles en peu d’actions.", "Aucune navigation complexe n’est ajoutée sans besoin."], [], { pagesIndicativesMax: 5 }),
  guideV2Pattern("grille-cartes", "Grille de cartes contextuelle", "catalogue, comparaison ou découverte", ["catalogue", "collection", "produit", "article", "découverte"], [], "Choisir une grille uniforme pour comparer, éditoriale pour hiérarchiser, ou libre pour inspirer ; ne pas mélanger ces intentions.", ["Les cartes comparables conservent une structure cohérente.", "La grille s’adapte sans couper les contenus essentiels."], [], { colonnesIndicatives: { mobile: 1, tablette: 2, desktop: "3 à 4" } }),
  guideV2Pattern("split-screen", "Split screen", "message visuel fort ou choix binaire", ["choix binaire", "particulier", "professionnel", "comparaison", "visuel"], ["petit écran", "contenu long"], "Réserver le split screen aux deux contenus réellement complémentaires et les empiler clairement sur petit écran.", ["Chaque colonne conserve un objectif distinct.", "L’ordre mobile reste logique."], [], { ratiosIndicatifs: ["50/50", "60/40"] }),
  guideV2Pattern("fullscreen-hero", "Hero immersif plein écran", "luxe, voyage ou narration émotionnelle", ["luxe", "voyage", "immersion", "émotion", "campagne"], ["dashboard", "performance contrainte", "contenu dense"], "Utiliser l’immersion seulement si elle sert la promesse ; préserver contraste, performance et accès immédiat au contenu.", ["Le texte reste lisible sur chaque média.", "Le média ne bloque pas le contenu ni la performance."], ["dashboard-principal"], {}, "grand_public"),
  guideV2Pattern("single-column", "Colonne de lecture", "article, documentation ou lecture longue", ["article", "documentation", "lecture", "guide", "contenu long"], [], "Limiter la largeur de lecture selon la typographie et conserver une progression claire.", ["La longueur de ligne reste confortable.", "La hiérarchie des titres permet de parcourir le contenu."], [], { largeurIndicativeMax: "720px" }),
  guideV2Pattern("bento-grid", "Bento grid hiérarchisé", "présentation de fonctionnalités variées", ["bento", "fonctionnalités", "portfolio", "présentation produit"], ["liste homogène", "comparaison stricte"], "Utiliser des tailles différentes uniquement pour exprimer une hiérarchie réelle, avec un ordre mobile explicite.", ["La taille des blocs correspond à leur importance.", "L’ordre de lecture reste cohérent sur mobile."]),
  guideV2Pattern("tabs-mobile", "Navigation principale par onglets mobiles", "application mobile avec peu de destinations stables", ["mobile", "application", "navigation fréquente", "onglet"], ["plus de cinq destinations", "navigation profonde"], "Utiliser des onglets avec icône et libellé pour trois à cinq destinations principales stables.", ["La destination active est identifiable sans dépendre uniquement de la couleur.", "Chaque onglet reste accessible et atteignable au pouce."], ["sidebar-mobile"], { destinationsIndicatives: "3 à 5" }),
  guideV2Pattern("breadcrumb", "Fil d’Ariane", "hiérarchie profonde", ["hiérarchie", "catalogue", "e-commerce", "plusieurs niveaux"], ["parcours linéaire", "navigation peu profonde"], "Afficher le chemin hiérarchique lorsque l’utilisateur doit comprendre sa position ou remonter plusieurs niveaux.", ["Chaque niveau est nommé clairement.", "Le fil ne remplace pas la navigation principale."]),
  guideV2Pattern("mega-menu", "Mega-menu de catalogue", "catalogue riche sur grand écran", ["catalogue riche", "catégorie", "e-commerce", "nombreux liens"], ["mobile", "navigation courte"], "Regrouper les destinations par catégories compréhensibles sur grand écran et fournir une navigation mobile dédiée.", ["Les groupes ont des libellés explicites.", "La version clavier et la fermeture sont testées."], [], { desktopSeulement: true }),
  guideV2Pattern("navigation-ancres", "Navigation par ancres", "page longue structurée", ["page longue", "sections", "one page", "documentation"], [], "Permettre d’atteindre les sections principales sans masquer leur titre sous une barre fixe.", ["Le lien actif et la cible sont compréhensibles.", "Le focus arrive sur la section visée."]),
  guideV2Pattern("formulaire-court", "Formulaire court en une page", "processus simple", ["contact", "connexion", "formulaire court", "moins de dix champs"], ["processus complexe", "nombreuses dépendances"], "Regrouper les champs courts sur une page avec labels persistants et erreurs proches des champs.", ["Les erreurs ne suppriment aucune saisie.", "L’action principale est explicite."], ["wizard"]),
  guideV2Pattern("wizard", "Formulaire progressif", "inscription, configuration ou processus long", ["inscription", "checkout", "configuration", "formulaire long", "étapes"], ["moins de dix champs", "comparaison globale nécessaire"], "Découper le processus selon des décisions cohérentes, afficher la progression et permettre le retour sans perte.", ["Précédent conserve les réponses.", "La progression et les erreurs de chaque étape sont compréhensibles."], ["formulaire-court"], { etapesIndicatives: "3 à 5" }),
  guideV2Pattern("feedback-action", "Feedback d’action immédiat", "toute action utilisateur avec délai perceptible", ["action", "enregistrement", "upload", "traitement", "attente"], [], "Accuser réception immédiatement puis utiliser squelette, progression ou état explicite selon la durée et la structure attendues.", ["Une action ne peut pas sembler ignorée.", "Le feedback ne promet pas une réussite avant confirmation."]),
  guideV2Pattern("toast", "Notification temporaire", "confirmation secondaire non bloquante", ["succès", "notification", "confirmation", "enregistré"], ["erreur critique", "action requise"], "Utiliser un toast pour une information secondaire ; garder visibles les erreurs qui exigent une action.", ["Le message reste accessible aux technologies d’assistance.", "Une erreur actionnable ne disparaît pas automatiquement."], [], { dureeSuccesIndicative: "3 à 5 secondes" }),
  guideV2Pattern("pull-refresh", "Actualisation par geste mobile", "flux mobile actualisable", ["mobile", "flux", "actualité", "liste dynamique"], ["desktop", "données locales stables"], "Proposer le geste comme raccourci sans supprimer un moyen explicite ou l’actualisation automatique adaptée.", ["Le geste fournit un feedback de chargement.", "L’actualisation ne duplique pas les éléments."]),
  guideV2Pattern("infinite-scroll", "Défilement continu de découverte", "flux de découverte sans objectif de repérage précis", ["flux", "social", "découverte", "inspiration"], ["recherche précise", "comparaison", "retrouver une position", "checkout"], "N’utiliser le défilement continu que pour la découverte et préserver reprise, accessibilité et fin de contenu.", ["La position peut être retrouvée après retour.", "Le chargement n’empêche pas d’atteindre les éléments de page."], ["pagination-recherche"], {}, "grand_public"),
  guideV2Pattern("crud", "Gestion CRUD cohérente", "gestion d’entités métier", ["gérer", "fiche", "liste", "création", "modification", "suppression"], [], "Conserver une structure cohérente liste, détail, création, modification et suppression, avec protection proportionnée des actions destructives.", ["Les droits s’appliquent à chaque opération.", "La suppression suit la stratégie d’annulation ou de confirmation définie."], [], {}, "entreprise"),
  guideV2Pattern("workflow-sequentiel", "Workflow séquentiel", "processus ordonné avec dépendances", ["workflow", "séquentiel", "étape", "validation", "checkout"], ["actions indépendantes"], "Afficher l’étape courante, les prérequis et les possibilités de retour sans provoquer de transition implicite.", ["Chaque transition est explicite.", "Une reprise restaure l’étape et les données correctes."]),
  guideV2Pattern("dashboard-analytique", "Dashboard analytique", "analyse d’indicateurs et de tendances", ["kpi", "graphique", "statistique", "tendance", "analyse"], [], "Hiérarchiser indicateurs, tendances et détails ; expliquer les unités, périodes, filtres et états sans données.", ["Chaque graphique possède un titre, une période et une unité.", "Les filtres actifs sont visibles et réinitialisables."], [], {}, "entreprise"),
  guideV2Pattern("fil-social", "Fil social", "contenu publié par des utilisateurs", ["social", "publication", "commentaire", "partage", "communauté"], ["usage solo"], "Construire le flux avec contexte, actions explicites, modération, reprise de position et stratégie de classement transparente.", ["Signalement et blocage sont accessibles.", "Le feedback des actions ne crée pas de doublon."], [], { classement: "à justifier" }, "grand_public"),
  guideV2Pattern("marketplace", "Parcours marketplace", "catalogue avec transaction", ["marketplace", "e-commerce", "produit", "panier", "paiement"], [], "Relier découverte, fiche, panier, paiement et confirmation en conservant prix, disponibilité et état de commande comme faits cohérents.", ["Le prix final est figé au moment de la transaction.", "Un double envoi ne crée pas deux commandes."], ["infinite-scroll-recherche"]),
  guideV2Pattern("messagerie", "Messagerie conversationnelle", "échanges privés ou collectifs", ["message", "chat", "conversation", "messagerie"], [], "Afficher état d’envoi réel, échecs, reprises et confidentialité ; ne promettre présence ou lecture que si le système les mesure réellement.", ["Un échec d’envoi peut être repris sans doublon.", "Les statuts envoyé, reçu et lu ne sont pas confondus."]),
  guideV2Pattern("recherche-avancee", "Recherche avec suggestions et facettes", "catalogue ou volume important", ["recherche", "filtre", "facette", "catalogue", "volume"], [], "Aider la formulation, montrer les filtres actifs et conserver une pagination ou un chargement explicite adapté au besoin de repérage.", ["Une recherche vide et sans résultat possède une issue utile.", "Les filtres peuvent être retirés individuellement et globalement."], ["infinite-scroll"]),
];
// CONFIRMATION RÉELLE (27/08/2026) — apport du porteur : mode sombre/clair et
// historique immuable confirmés nécessaires sur 3 projets réels indépendants
// (NANDĒM Core lui-même, B&B Clean Pro, application foodtruck). Ça atteint le
// seuil de 3 projets indépendants utilisé ailleurs pour envisager une
// promotion — mais Prometteur→Établi reste une décision du porteur (à faire
// depuis Optimisation/Bibliothèque), jamais automatique ici : on met à jour
// uniquement la preuve réelle disponible (preuves.projetsReels), le statut
// simulé (Prometteur) est conservé tel quel.
const REAL_PROJECT_CONFIRMATIONS = {
  "default:theme-contextuel": { projetsReels: 3, note: "Confirmé nécessaire sur NANDĒM Core, B&B Clean Pro et l'application foodtruck." },
  "default:historique-fige": { projetsReels: 3, note: "Confirmé nécessaire sur NANDĒM Core, B&B Clean Pro et l'application foodtruck." },
};
function applyRealConfirmations(requirements) {
  return requirements.map((item) => {
    const confirmation = REAL_PROJECT_CONFIRMATIONS[item.id];
    if (!confirmation) return item;
    return { ...item, preuves: { ...item.preuves, projetsReels: confirmation.projetsReels }, provenance: { ...item.provenance, confirmationPorteur: confirmation.note } };
  });
}
// Nouveau pattern (27/08/2026), formalisé à partir de l'expérience réelle du
// porteur — pas de la simulation ni du Guide V2 : distinction devis
// (proposition envoyée, non engageante) / facture (preuve de paiement, jamais
// recalculée après coup), avec suivi du temps passé pour comparer le coût
// réel au prix annoncé. Confirmé nécessaire sur 3 projets réels indépendants
// (NANDĒM Core, B&B Clean Pro, application foodtruck) — statut laissé à
// Prometteur : la promotion en Établi reste une décision du porteur.
const PORTEUR_REQUIREMENTS = [
  {
    id: "porteur:facturation-devis-facture", version: 1,
    label: "Distinction devis / facture avec suivi du coût réel",
    famille: "Apport du porteur — expérience réelle multi-projets",
    portee: { niveau: "famille", cible: "prestataires indépendants et TPE avec des clients à facturer" }, publicCible: "entreprise",
    statut: "Prometteur", priorite: 3,
    declencheurs: ["facture", "facturation", "devis", "paiement", "encaissement", "prestataire", "indépendant", "tarif", "acompte"],
    exclusions: ["contenu éditorial ou vitrine sans transaction", "outil interne sans relation commerciale"],
    instruction: "Distinguer explicitement le devis (proposition envoyée au client, non engageante, modifiable) de la facture (preuve d'un paiement reçu, jamais recalculée après coup). Permettre un suivi simple du temps passé pour comparer le coût réel au prix forfaitaire annoncé.",
    questions: ["Le projet a-t-il besoin de distinguer une proposition commerciale (devis) d'une preuve de paiement (facture) ?", "Le porteur a-t-il besoin de comparer le temps réellement passé au prix annoncé au client ?"],
    tests: ["Un devis modifié après envoi ne modifie jamais le montant d'une facture déjà émise.", "Le temps passé saisi permet de calculer un coût réel indépendant du prix forfaitaire."],
    preuves: { projetsFictifs: 0, projetsReels: 3, bugsConfirmes: 0, contreExemples: 0 },
    provenance: { type: "apport-porteur", source: "Expérience réelle sur NANDĒM Core, B&B Clean Pro et l'application foodtruck", statut: "confirmé sur 3 projets réels indépendants, promotion à valider par le porteur" },
    importedAt: "2026-08-27T00:00:00.000Z", lockedDefault: true,
  },
];
// Patterns "secteur" (27/08/2026) — le niveau existait déjà dans l'axe de
// portée (universel/famille/secteur/spécifique) mais aucun pattern ne
// l'utilisait encore : un secteur sensible (santé, juridique, enfance,
// finance) impose les mêmes principes qu'il s'agisse d'une appli grand public
// (ex. suivi de santé perso) ou d'un outil d'entreprise (ex. logiciel pour
// médecin) — donc publicCible reste "universel" même si niveau est "secteur".
// Réutilise SECTOR_KEYWORDS et SECTOR_EXTRA_GOALS (déjà utilisés pour la
// détection de secteur en Discovery) au lieu de dupliquer une nouvelle liste
// de mots-clés ou de questions.
function secteurPattern(key) {
  const extra = SECTOR_EXTRA_GOALS[key];
  return {
    id: `secteur:${key}`, version: 1, label: extra.label, famille: "Secteur sensible — Discovery",
    portee: { niveau: "secteur", cible: key }, publicCible: "universel",
    statut: "Hypothèse", priorite: 4,
    declencheurs: SECTOR_KEYWORDS[key], exclusions: [],
    instruction: `Vu le secteur détecté (${extra.label}) : ${extra.question} S'applique que le projet soit une appli grand public ou un outil d'entreprise — le secteur impose les mêmes exigences dans les deux cas.`,
    questions: [extra.question],
    tests: [`La réponse à « ${extra.label} » est documentée et n'est pas laissée par défaut.`, "La contrainte du secteur reste appliquée même si le projet change de catégorie (Entreprise/App) en cours de route."],
    preuves: { projetsFictifs: 0, projetsReels: 0, bugsConfirmes: 0, contreExemples: 0 },
    provenance: { type: "apport-porteur", source: "Formalisation du système de détection sectorielle déjà existant (SECTOR_EXTRA_GOALS)", statut: "candidat, à confirmer sur un projet réel du secteur" },
    importedAt: "2026-08-27T00:00:00.000Z", lockedDefault: true,
  };
}
const SECTEUR_REQUIREMENTS = Object.keys(SECTOR_EXTRA_GOALS).filter((key) => key !== "public").map(secteurPattern);
const DEFAULT_ENGINE_REQUIREMENTS = applyRealConfirmations([...SIMULATION_DEFAULT_REQUIREMENTS, ...GUIDE_V2_REQUIREMENTS, ...PORTEUR_REQUIREMENTS, ...SECTEUR_REQUIREMENTS]);
function mergeDefaultEngineRequirements(saved = []) {
  const byId = new Map(DEFAULT_ENGINE_REQUIREMENTS.map((item) => [item.id, item]));
  saved.forEach((item) => { if (item?.id) byId.set(item.id, item); });
  return Array.from(byId.values());
}
function compareProjectWithSimulation(projectText) {
  const normalized = String(projectText || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return SIMULATION_200_BASELINE.map((baseline) => {
    const check = DEFAULT_RELEVANCE_CHECKS.find((item) => item.id === baseline.id);
    const matches = baseline.signals.filter((signal) => normalized.includes(signal.normalize("NFD").replace(/[\u0300-\u036f]/g, "")));
    return { ...baseline, label: check?.label || baseline.id, question: check?.question || "", matches, applicable: matches.length > 0, confidence: matches.length >= 2 ? "Correspondance forte" : matches.length === 1 ? "À vérifier" : "Non détecté" };
  }).sort((a, b) => Number(b.applicable) - Number(a.applicable) || b.matches.length - a.matches.length || b.frequency - a.frequency);
}

function requirementScopeId(requirement) { return typeof requirement.portee === "object" ? (requirement.portee.niveau || "a_classer") : (requirement.portee || "a_classer"); }
// CORRECTIF (17/08/2026, test\u00e9 r\u00e9ellement sur B&B Clean Pro) : les marques
// diacritiques \u00e9taient remplac\u00e9es par un ESPACE, pas supprim\u00e9es \u2014 un mot
// comme "g\u00e9rer" (g,\u00e9,r,e,r) devenait "ge rer" une fois d\u00e9compos\u00e9 en NFD,
// puis coup\u00e9 en deux par le split, donnant les fragments "ge" (rejet\u00e9,
// longueur \u2264 2) et "rer" (conserv\u00e9). R\u00e9sultat mesur\u00e9 : "d\u00e9broussaillage"
// perdait son pr\u00e9fixe et devenait juste "broussaillage", "g\u00e9rer" devenait
// "rer" \u2014 des fragments qui produisaient des correspondances de mots-cl\u00e9s
// sans rapport avec le sens r\u00e9el (ex. "Fil social" s\u00e9lectionn\u00e9 \u00e0 cause du
// seul fragment "rer"). Remplacer par une cha\u00eene vide fusionne l'accent
// dans sa lettre de base au lieu de couper le mot en deux.
const NORMALIZED_WORDS_STOPWORDS = new Set([
  "les", "des", "une", "sur", "par", "non", "oui", "avec", "pour", "dans",
  "sont", "est", "qui", "que", "aux", "ses", "ces", "son", "sans", "tout",
  "tous", "toute", "toutes", "plus", "chaque", "cette", "comme", "mais",
  "donc", "car", "elle", "elles", "ils", "leur", "leurs", "nos", "vos",
]);
function normalizedWords(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9]+/).filter((word) => word.length > 2 && !NORMALIZED_WORDS_STOPWORDS.has(word));
}
function selectRequirementsForProject(project, requirements = []) {
  const s = project.discovery?.synthesis || {};
  const answers = project.discovery?.answers || {};
  const profile = [project.nom, project.categorie, project.secteurTag, ...Object.values(s), ...Object.values(answers).map((a) => a?.text)].filter(Boolean).join(" ");
  const haystack = new Set(normalizedWords(profile));
  const overrides = project.requirementOverrides || { include: [], exclude: [] };
  // 2e axe de portée (27/08/2026) : Entreprise / Grand public / Universel, en
  // plus du niveau existant — réutilise questionnaireFamily() (déjà utilisé
  // pour choisir le questionnaire de diagnostic) plutôt que de dupliquer la
  // règle Entreprise vs App/Laboratoire/Interne.
  const projectFamily = questionnaireFamily(project.categorie); // "app" | "entreprise"
  const selected = []; const rejected = [];
  requirements.forEach((requirement) => {
    const scope = requirementScopeId(requirement);
    const target = typeof requirement.portee === "object" ? requirement.portee.cible : "";
    const triggers = [...(requirement.declencheurs || []), target].flatMap(normalizedWords);
    const exclusions = (requirement.exclusions || []).flatMap(normalizedWords);
    const triggerMatches = triggers.filter((word) => haystack.has(word));
    const exclusionMatches = exclusions.filter((word) => haystack.has(word));
    const publicCible = requirement.publicCible || "universel";
    const publicMismatch = publicCible !== "universel" && !(publicCible === "entreprise" && projectFamily === "entreprise") && !(publicCible === "grand_public" && projectFamily === "app");
    let reason = "Aucun signal suffisant pour ce projet";
    let isSelected = false;
    if (overrides.exclude?.includes(requirement.id)) reason = "Exclue manuellement pour ce projet";
    else if (overrides.include?.includes(requirement.id)) { isSelected = true; reason = "Incluse manuellement pour ce projet"; }
    else if (publicMismatch) reason = `Hors cible : pattern ${publicCible === "entreprise" ? "Entreprise" : "Grand public"}, projet ${projectFamily === "entreprise" ? "Entreprise" : "Grand public"}`;
    else if (scope === "universel") { isSelected = true; reason = "Exigence universelle validée"; }
    else if (scope !== "a_classer" && triggerMatches.length > 0 && exclusionMatches.length === 0) { isSelected = true; reason = `Correspondance projet : ${triggerMatches.slice(0, 4).join(", ")}`; }
    else if (exclusionMatches.length > 0) reason = `Exclusion détectée : ${exclusionMatches.slice(0, 4).join(", ")}`;
    (isSelected ? selected : rejected).push({ requirement, reason });
  });
  return { selected, rejected };
}
function detectMethodConstraints(synthesis) {
  if (!synthesis) return [];
  const haystack = [synthesis.activite, synthesis.processusMetier, synthesis.objetsMetier, synthesis.informationsManipulees, synthesis.fonctionnalitesV1, synthesis.contraintes, synthesis.priorites]
    .filter(Boolean).join(" ").toLowerCase();
  return METHOD_CONSTRAINT_LIBRARY.filter((c) => c.keywords.some((k) => haystack.includes(k)));
}
const SECTOR_RAW_LABELS = {
  extra_sante: "Confidentialité santé",
  extra_juridique: "Secret professionnel",
  extra_enfance: "Sécurité des mineurs",
  extra_finance: "Réglementation financière",
  extra_public: "Accessibilité",
};
const ALL_GOAL_DEFS = [...GOALS_ENTREPRISE, ...GOALS_APP, ...Object.values(SECTOR_EXTRA_GOALS)];
function parseClientEmail(raw) {
  const labelToGoal = new Map(ALL_GOAL_DEFS.map((g) => [g.label.toLowerCase(), g]));
  const answers = {};
  raw.split("\n").forEach((line) => {
    const idx = line.indexOf(" : ");
    if (idx === -1) return;
    const label = line.slice(0, idx).trim();
    const text = line.slice(idx + 3).trim();
    if (!text) return;
    if (label.toLowerCase() === "remarque libre") { answers.commentaireLibre = { text, label: "Remarque libre" }; return; }
    const goal = labelToGoal.get(label.toLowerCase());
    if (goal) answers[goal.id] = { text, label: goal.label };
  });
  return answers;
}

// Chaque questionnaire (GOALS_ENTREPRISE / GOALS_APP) porte déjà sa propre
// formulation finale — plus besoin de reformulation conditionnelle par
// catégorie ici.
function questionFor(goal) {
  return goal.question;
}

const VAGUE_MARKERS = ["sais pas", "peut être", "peut-être", "pas sûr", "pas sur", "je verrai", "un peu", "comme ça", "bof", "chais pas"];
function isVague(a) {
  const t = a.trim().toLowerCase();
  const wordCount = t.split(/\s+/).filter(Boolean).length;
  if (wordCount <= 2) return true;
  // Les mots-clés de flou ("peut-être", "un peu"...) ne comptent que sur des
  // réponses courtes — une réponse riche qui contient l'un de ces mots au
  // milieu de 50 mots de contenu solide n'est pas floue pour autant.
  if (wordCount <= 8 && VAGUE_MARKERS.some((m) => t.includes(m))) return true;
  return false;
}
function confidenceFor(a) { const w = a.trim().split(/\s+/).filter(Boolean).length; return Math.min(100, 65 + w * 3); }
function stateFor(c) { if (c >= 60) return "confirme"; if (c >= 30) return "partiel"; return "inconnu"; }

// Clé API optionnelle — nécessaire uniquement hors de l'environnement Claude
// (ex. déploiement CodeSandbox), où il n'y a plus de proxy automatique.
// Ne jamais renseigner cette clé sur une version dont le lien circule
// publiquement : elle serait visible dans le navigateur de n'importe qui.
let ANTHROPIC_API_KEY = null;
// Fournisseur choisi dans Réglages ("anthropic" | "lmstudio" | "custom") —
// jamais codé en dur, pour ne pas dépendre d'une seule IA pour l'appel.
// "custom" (27/08/2026) est un 3e choix générique compatible OpenAI (URL de
// base + clé + modèle) : couvre n'importe quel fournisseur qui parle ce
// format (OpenAI, Mistral, Groq, OpenRouter, DeepSeek...) sans coder chaque
// service un par un — répond à "avec juste une clé je pourrais utiliser
// n'importe quelle IA". LM Studio et "custom" n'ont de sens qu'en local (le
// relais tourne sur la machine du porteur) : hors localhost, on retombe
// toujours sur Anthropic quel que soit ce réglage.
let AI_PROVIDER = "anthropic";
let CUSTOM_AI_BASE_URL = null;
let CUSTOM_AI_MODEL = null;
let CUSTOM_AI_KEY = null;
function setAnthropicApiKey(key) { ANTHROPIC_API_KEY = key || null; }
function setAiProvider(provider) { AI_PROVIDER = ["lmstudio", "custom"].includes(provider) ? provider : "anthropic"; }
function setCustomAiConfig({ baseUrl, model, apiKey } = {}) { CUSTOM_AI_BASE_URL = baseUrl || null; CUSTOM_AI_MODEL = model || null; CUSTOM_AI_KEY = apiKey || null; }
function anthropicHeaders(base) {
  return ANTHROPIC_API_KEY
    ? { ...base, "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" }
    : base;
}
function useLocalAiRelay() {
  return typeof window !== "undefined" && ["127.0.0.1", "localhost", "::1"].includes(window.location.hostname);
}
async function callAnthropic(body) {
  const local = useLocalAiRelay();
  const response = await fetch(local ? "/__nandem_ai" : "https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: local
      ? {
          "Content-Type": "application/json",
          "x-nandem-ai-provider": AI_PROVIDER,
          ...(ANTHROPIC_API_KEY ? { "x-nandem-api-key": ANTHROPIC_API_KEY } : {}),
          ...(AI_PROVIDER === "custom" ? {
            "x-nandem-custom-base-url": CUSTOM_AI_BASE_URL || "",
            "x-nandem-custom-model": CUSTOM_AI_MODEL || "",
            "x-nandem-custom-api-key": CUSTOM_AI_KEY || "",
          } : {}),
        }
      : anthropicHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  }).catch((error) => { throw new Error(`Connexion impossible au service de synthèse (${error.message || "réseau indisponible"})`); });
  if (!response.ok) {
    let detail = "";
    try { detail = String((await response.json())?.error || ""); } catch {}
    if (response.status === 400 && detail.includes("clé API")) throw new Error("Aucune clé API configurée et le moteur Codex local n’est pas disponible");
    if (response.status === 401) throw new Error("La clé API est refusée ou invalide. Vérifie-la dans Réglages");
    if (response.status === 429) throw new Error("Limite ou crédit API atteint. Vérifie ton compte puis réessaie");
    throw new Error(detail || `Appel API échoué (${response.status})`);
  }
  return response;
}
async function askClaude(userContent, maxTokens = 1500) {
  const response = await callAnthropic({ model: "claude-sonnet-4-6", max_tokens: maxTokens, messages: [{ role: "user", content: userContent }] });
  const data = await response.json();
  return data.content.map((b) => (b.type === "text" ? b.text : "")).filter(Boolean).join("\n").trim();
}

// Les conceptions techniques peuvent dépasser la limite de sortie d'un seul
// appel. Contrairement aux réponses JSON (qui doivent rester atomiques), ce
// helper poursuit automatiquement une réponse Markdown coupée par max_tokens.
// Le nombre de continuations est borné pour garder le coût prévisible.
async function askClaudeCompleteMarkdown(userContent, maxTokens = 3500, maxContinuations = 2) {
  const messages = [{ role: "user", content: userContent }];
  let completeText = "";

  for (let attempt = 0; attempt <= maxContinuations; attempt += 1) {
    const response = await callAnthropic({ model: "claude-sonnet-4-6", max_tokens: maxTokens, messages });

    const data = await response.json();
    const part = data.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .filter(Boolean)
      .join("\n")
      .trim();
    if (!part) throw new Error("Réponse vide reçue pendant la génération de la conception.");

    completeText += `${completeText ? "\n" : ""}${part}`;
    if (data.stop_reason !== "max_tokens") return completeText.trim();

    if (attempt === maxContinuations) {
      throw new Error("La conception reste trop longue après plusieurs continuations.");
    }
    messages.push(
      { role: "assistant", content: part },
      { role: "user", content: "Continue exactement à l'endroit où tu t'es arrêté. Ne répète aucune section et termine toutes les sections demandées." },
    );
  }

  return completeText.trim();
}
function extractJSON(raw) {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const first = cleaned.indexOf("{");
  const firstArr = cleaned.indexOf("[");
  const start = first === -1 ? firstArr : (firstArr === -1 ? first : Math.min(first, firstArr));
  const lastCurly = cleaned.lastIndexOf("}");
  const lastSquare = cleaned.lastIndexOf("]");
  const end = Math.max(lastCurly, lastSquare);
  if (start === -1 || end === -1) return JSON.parse(cleaned); // laisse planter avec l'erreur d'origine si vraiment rien d'exploitable
  return JSON.parse(cleaned.slice(start, end + 1));
}
async function relanceVague(goal, answer) {
  const prompt = `Tu formules UNE relance de clarification, maximum 20 mots, aucune proposition, aucune solution.
Sujet : ${goal.label}
Réponse floue reçue : "${answer}"
Réponds uniquement avec la question, rien d'autre.`;
  try { return (await askClaude(prompt)).replace(/^["«]|["»]$/g, "").trim(); }
  catch { return `Tu peux préciser un peu plus, concrètement, sur "${goal.label.toLowerCase()}" ?`; }
}
// Contrôle de pertinence — remplace l'ancienne détection locale (isVague), qui
// ne repérait que les réponses TRÈS courtes ou contenant un marqueur
// d'hésitation. Un test réel a montré des réponses de longueur "moyenne" qui
// passaient sans aucun contrôle : hors-sujet ("je te parle du secteur du
// bâtiment" en réponse à une question sur la stack technique), circulaires
// ("j'ai pas l'application" comme frustration), ou qui recopient juste les
// mots de la question sans info réelle. Un seul appel IA fait à la fois le
// diagnostic et, si besoin, la relance — pas deux appels séparés.
async function checkAnswer(goal, answer) {
  const prompt = `Tu vérifies si une réponse répond réellement à une question de diagnostic de projet. Aucun jugement sur le style ou l'orthographe — seulement si l'information demandée est présente.
Question posée : "${goal.question}"
Réponse reçue : "${answer}"

Cette réponse apporte-t-elle une information utilisable pour CE sujet précis (même courte, même informelle) ? Réponds "false" si elle est hors-sujet, si elle recopie juste les mots de la question sans rien dire de nouveau, ou si elle reste une généralité qui n'apporte aucune information concrète (ex. répéter qu'on n'a pas encore l'app à une question qui demande autre chose).
Réponds UNIQUEMENT avec un objet JSON : {"utilisable": true ou false, "relance": "..."}
Si utilisable est false : "relance" est UNE question de clarification, maximum 20 mots, sans proposer de solution.
Si utilisable est true : "relance" est une chaîne vide.`;
  try {
    const parsed = extractJSON(await askClaude(prompt, 200));
    return { ok: !!parsed.utilisable, relance: (parsed.relance || "").trim() };
  } catch {
    // Échec réseau/parsing : ne jamais bloquer la personne à cause d'un problème technique de notre côté.
    return { ok: true, relance: "" };
  }
}
async function extractMultipleAnswers(text, remainingGoals) {
  if (!remainingGoals.length) return {};
  const list = remainingGoals.map((g) => `${g.id} : ${g.question}`).join("\n");
  const prompt = `Une personne vient de décrire librement son projet, comme elle le ferait à un designer — sans forcément suivre l'ordre des questions. Voici des sujets encore à couvrir (id : question) :
${list}

Texte de la personne :
"${text}"

Indique UNIQUEMENT les sujets que ce texte couvre déjà clairement, avec une reformulation fidèle de sa réponse (pas un copier-coller brut, mais rien d'inventé). Ignore tout sujet non abordé — ne force rien. Réponds UNIQUEMENT avec un objet JSON {"id": "réponse reformulée", ...}, vide ({}) si rien n'est clairement couvert.`;
  try { return extractJSON(await askClaude(prompt, 1200)); } catch { return {}; }
}
async function extractFromDocuments(contentBlocks, extraTextNotes, allGoals) {
  if (!contentBlocks.length && !extraTextNotes?.trim()) return {};
  const list = allGoals.map((g) => `${g.id} : ${g.question}`).join("\n");
  const instructionText = `Voici des documents fournis par une personne qui décrit son projet (captures d'écran, PDF, notes libres...). Sujets à couvrir (id : question) :
${list}
${extraTextNotes?.trim() ? `\nNotes texte fournies en plus :\n${extraTextNotes.trim()}\n` : ""}
Indique UNIQUEMENT les sujets que ces documents couvrent déjà clairement. Reformule dans tes propres mots, ne recopie jamais de texte verbatim. Réponds UNIQUEMENT avec un objet JSON {"id": "réponse reformulée", ...}, vide ({}) si rien n'est exploitable.`;
  const content = [...contentBlocks, { type: "text", text: instructionText }];
  try {
    const response = await callAnthropic({ model: "claude-sonnet-4-6", max_tokens: 2000, messages: [{ role: "user", content }] });
    const data = await response.json();
    const raw = data.content.map((b) => (b.type === "text" ? b.text : "")).filter(Boolean).join("\n").trim();
    return extractJSON(raw);
  } catch { return {}; }
}
function buildSynthesisPrompt(answers, rawConversation) {
  const transcript = Object.entries(answers).filter(([id]) => id !== "commentaireLibre").map(([, a]) => `${a.label} : ${a.text}`).join("\n");
  const extra = answers.commentaireLibre?.text ? `\n\nRemarque libre ajoutée par la personne (à prendre en compte si pertinent) : ${answers.commentaireLibre.text}` : "";
  const conversationBlock = rawConversation?.length
    ? `\n\n--- Conversation brute complète (utilise-la pour ne rien manquer, en particulier si un détail y apparaît sans être repris dans les réponses structurées ci-dessus) ---\n${formatTranscript(rawConversation)}`
    : "";
  return `Voici les réponses recueillies pendant un entretien de découverte de besoin. Produis UNIQUEMENT un objet JSON (pas de texte autour, pas de balises markdown), en français, avec exactement ces clés :
resume, besoinReel, activite, utilisateurs, objetsMetier, processusMetier, informationsManipulees, difficultes, frustrations, opportunitesAutomatisation, fonctionnalitesV1, fonctionnalitesFutures, contraintes, priorites, complexite (une valeur parmi: Faible, Moyenne, Élevée), questionsOuvertes.
Ne rien inventer qui ne soit pas déductible des réponses ou de la conversation ; si une information manque vraiment, écris "Non renseigné".

Réponses recueillies :
${transcript}${extra}${conversationBlock}`;
}
async function buildSynthesis(answers, rawConversation) {
  const prompt = buildSynthesisPrompt(answers, rawConversation);
  const raw = await askClaude(prompt, 3000);
  return extractJSON(raw);
}
// Document commercial à envoyer au client — distinct de la conception
// technique (destinée à Claude Code). Ici : ce qu'on a compris, ce qui est
// prévu en V1, prix et délai si renseignés, prochaines étapes. Jamais de
// jargon technique — c'est fait pour convaincre, pas pour coder.
async function buildProposal(synthesis, finance, studioName) {
  const prixBlock = finance?.devis != null
    ? `\nMontant proposé : ${finance.devis} €${finance.note ? ` (${finance.note})` : ""}.`
    : `\nAucun montant chiffré pour l'instant — laisse "Investissement" en indicatif ou à discuter.`;
  const prompt = `Rédige une proposition commerciale courte et chaleureuse, en français, à envoyer telle quelle à un client potentiel. Studio : ${studioName || "le studio"}. Pas de jargon technique, pas de code, pas de nom de fichier. Format Markdown avec ces sections :
## Ce qu'on a compris de votre besoin
## Ce qu'on vous propose (périmètre de la V1)
## Ce qui n'est pas inclus dans cette première version (mais possible ensuite)
## Investissement
## Prochaines étapes
Reste concret et rassurant, base-toi uniquement sur les informations ci-dessous, n'invente rien de plus.

Résumé : ${synthesis.resume}
Besoin réel : ${synthesis.besoinReel}
Fonctionnalités V1 : ${synthesis.fonctionnalitesV1}
Fonctionnalités futures : ${synthesis.fonctionnalitesFutures}
Complexité estimée : ${synthesis.complexite}${prixBlock}`;
  return await askClaude(prompt, 1800);
}
// Plancher absolu — jamais chiffré en dessous, quelle que soit la complexité
// ou les réglages tarifaires (protection même si un champ tarif est laissé
// vide ou mal réglé).
const PRIX_MINIMUM = 300;
function computeDevisPrice(complexite, tarifSettings) {
  const parTier = { "Faible": tarifSettings?.tarifFaible, "Moyenne": tarifSettings?.tarifMoyenne, "Élevée": tarifSettings?.tarifElevee };
  const brut = Number(parTier[complexite]);
  return Math.max(Number.isFinite(brut) && brut > 0 ? brut : PRIX_MINIMUM, PRIX_MINIMUM);
}
// Devis complet, chiffré — distinct de la proposition commerciale (qualitative).
// Le prix est calculé côté code (jamais laissé à l'appréciation de l'IA), le
// texte autour est généré pour rester prêt à coller dans un mail.
async function buildDevis(synthesis, prix, studioName, feedbackEmail) {
  const delaiIndicatif = { "Faible": "1 à 2 semaines", "Moyenne": "2 à 4 semaines", "Élevée": "4 à 8 semaines" }[synthesis.complexite] || "à estimer selon le périmètre final";
  const prompt = `Rédige un devis complet, en français, prêt à être copié tel quel dans un mail à un client. Studio : ${studioName || "le studio"}. Contact : ${feedbackEmail || "à compléter"}. Pas de jargon technique, pas de code.

Le prix à annoncer est FIXE, déjà calculé, ne le recalcule pas et ne le modifie pas : ${prix} €.
Délai indicatif à mentionner : ${delaiIndicatif} (précise que c'est indicatif, ajustable selon le périmètre final validé ensemble).

Structure en Markdown :
## Objet
## Résumé du besoin
## Ce qui est inclus dans ce devis
## Ce qui n'est pas inclus (évolutions possibles ensuite, hors périmètre)
## Délai estimé
## Prix
## Conditions
Modalités de paiement (acompte à la commande, solde à la livraison — formulation à toi de choisir), validité de l'offre (ex. 30 jours), et une phrase de clôture invitant à revenir vers toi pour toute question.
Reste concret, base-toi uniquement sur les informations ci-dessous, n'invente rien de plus que ce qui est donné.

Résumé : ${synthesis.resume}
Besoin réel : ${synthesis.besoinReel}
Fonctionnalités V1 : ${synthesis.fonctionnalitesV1}
Fonctionnalités futures (hors devis) : ${synthesis.fonctionnalitesFutures}
Complexité estimée : ${synthesis.complexite}`;
  return await askClaude(prompt, 2000);
}
// Brouillon immédiatement disponible, sans appel IA. Le montant est calculé
// une seule fois puis conservé dans le projet : une évolution ultérieure des
// tarifs ne réécrit donc jamais un devis déjà préparé.
function buildDevisTemplate(project, prix, studioName, feedbackEmail) {
  const synthesis = project.discovery?.synthesis || {};
  const clientName = project.client?.nom || "À compléter";
  const delai = { "Faible": "1 à 2 semaines", "Moyenne": "2 à 4 semaines", "Élevée": "4 à 8 semaines" }[synthesis.complexite] || "À confirmer ensemble";
  const included = Array.isArray(synthesis.fonctionnalitesV1) ? synthesis.fonctionnalitesV1.map((item) => `- ${item}`).join("\n") : `- ${synthesis.fonctionnalitesV1 || "Périmètre à confirmer avec le client"}`;
  const excluded = Array.isArray(synthesis.fonctionnalitesFutures) ? synthesis.fonctionnalitesFutures.map((item) => `- ${item}`).join("\n") : `- ${synthesis.fonctionnalitesFutures || "Évolutions futures à chiffrer séparément"}`;
  const today = new Date();
  const validity = new Date(today); validity.setDate(validity.getDate() + 30);
  return `# DEVIS — ${project.nom || "Projet"}

Émetteur : ${studioName || "NANDĒM"}
Contact : ${feedbackEmail || "À compléter"}
Client : ${clientName}
Date : ${today.toLocaleDateString("fr-FR")}
Valable jusqu'au : ${validity.toLocaleDateString("fr-FR")}

## Objet
Conception et réalisation de ${project.nom || "l'application décrite lors du diagnostic"}.

## Besoin compris
${synthesis.besoinReel || synthesis.resume || "À compléter avant l'envoi."}

## Inclus dans le devis
${included}

## Hors périmètre de cette version
${excluded}

## Délai indicatif
${delai}, à compter de la validation du périmètre et de la réception de l'acompte.

## Prix forfaitaire
${prix} €

## Conditions proposées
- 30 % d'acompte à la commande : ${(prix * 0.3).toFixed(2)} €
- Solde à la livraison : ${(prix * 0.7).toFixed(2)} €
- Toute demande hors périmètre fera l'objet d'un accord et d'un chiffrage séparés.

Bon pour accord — date, nom et signature :
`;
}
// Facture (27/08/2026) — distincte du devis à la demande du porteur : « le
// devis c'est ce que j'envoie au client, la facture c'est quand le client a
// payé ». Document déterministe, sans appel IA, pour rester rapide à éditer
// (pas d'attente réseau) — numéro, date et montant restent modifiables à la
// main, jamais recalculés automatiquement une fois émise (montant historique
// figé, même règle que pour le devis).
function buildFactureTemplate(project, facture, tempsEntries, studioName, feedbackEmail) {
  const clientName = project.client?.nom || "À compléter";
  const today = new Date();
  const dateStr = facture.date ? new Date(facture.date).toLocaleDateString("fr-FR") : today.toLocaleDateString("fr-FR");
  const totalHeures = (tempsEntries || []).reduce((sum, e) => sum + (Number(e.heures) || 0), 0);
  const lignesTemps = (tempsEntries || []).length
    ? (tempsEntries || []).map((e) => `- ${new Date(e.date).toLocaleDateString("fr-FR")} — ${e.heures} h${e.note ? ` — ${e.note}` : ""}`).join("\n")
    : null;
  return `# FACTURE ${facture.numero ? `N° ${facture.numero}` : ""} — ${project.nom || "Projet"}

Émetteur : ${studioName || "NANDĒM"}
Contact : ${feedbackEmail || "À compléter"}
Client : ${clientName}
Date : ${dateStr}

## Objet
Réalisation de ${project.nom || "l'application"}.
${lignesTemps ? `\n## Temps passé (${totalHeures} h au total)\n${lignesTemps}\n` : ""}
## Montant réglé
${facture.montant != null ? `${facture.montant} €` : "À compléter"}
${facture.note ? `\n## Note\n${facture.note}\n` : ""}
Facture acquittée.
`;
}
async function buildConception(synthesis, ambianceText, validatedIdeas, notesComplementaires) {
  const ambianceBlock = ambianceText
    ? `\n## Direction visuelle suggérée\nÀ partir de l'ambiance décrite ci-dessous, propose une direction concrète et exploitable directement par Claude Code, pas une simple phrase d'intention :\n- palette : 4 à 6 couleurs nommées AVEC leur valeur hex (ex. "vert sauge #8A9A7E, ivoire #F4F1EA, terracotta #C9714E")\n- typographie : un rôle affichage (titres, avec une piste de police précise) et un rôle texte courant (corps de texte, une police différente)\n- une ambiance générale en une phrase\nNe pars pas d'un choix générique par défaut (ex. crème + terracotta + serif, qui est le rendu IA le plus commun) — pars réellement de ce que la personne a décrit.\nAmbiance décrite par la personne : "${ambianceText}"`
    : "";
  const ideasBlock = validatedIdeas?.length
    ? `\n\nSuggestions déjà validées par la personne, à intégrer dans l'architecture et les écrans (pas juste mentionnées à part) :\n${validatedIdeas.map((v) => `- ${v.label} : ${v.description}`).join("\n")}`
    : "";
  const notesBlock = notesComplementaires?.trim()
    ? `\n\nNotes complémentaires ajoutées par la personne après réflexion (à prendre en compte, ça peut affiner ou corriger ce qui précède) :\n${notesComplementaires.trim()}`
    : "";
  const prompt = `À partir de ce cahier des charges, produis une conception technique en français, en Markdown clair (pas de JSON), avec ces sections :
## Architecture proposée
## Écrans (liste, avec le rôle de chacun en une ligne)
## Modèle de données simplifié (entités et champs principaux, pas de SQL)
## Ordre de construction suggéré
Liste les fonctionnalités V1 dans l'ordre où les construire (la plus structurante d'abord — ce sur quoi le reste dépend), chacune avec un critère concret de "c'est terminé" (une phrase vérifiable, pas "ça marche bien").
## Points d'attention pour le développement${ambianceText ? "\n## Direction visuelle suggérée" : ""}
Reste concret, n'invente rien qui ne découle pas du cahier des charges.

Cahier des charges :
Résumé : ${synthesis.resume}
Besoin réel : ${synthesis.besoinReel}
Utilisateurs : ${synthesis.utilisateurs}
Objets métier : ${synthesis.objetsMetier}
Processus métier : ${synthesis.processusMetier}
Informations manipulées : ${synthesis.informationsManipulees}
Fonctionnalités V1 : ${synthesis.fonctionnalitesV1}
Contraintes : ${synthesis.contraintes}
Complexité estimée : ${synthesis.complexite}${ideasBlock}${notesBlock}${ambianceBlock}`;
  const conception = await askClaudeCompleteMarkdown(prompt, 3500, 2);
  const requiredSections = [
    "## Architecture proposée",
    "## Écrans",
    "## Modèle de données simplifié",
    "## Ordre de construction suggéré",
    "## Points d'attention pour le développement",
  ];
  const missingSections = requiredSections.filter((heading) => !conception.includes(heading));
  if (missingSections.length) {
    throw new Error(`Conception incomplète : section(s) absente(s) — ${missingSections.join(", ")}`);
  }
  return conception;
}
async function suggestMetierIdeas(synthesis) {
  const prompt = `Tu connais bien les pratiques courantes de ce type d'activité (à partir de sa description ci-dessous). Propose 3 à 5 idées d'amélioration ou de fonctionnalités pertinentes pour ce métier — des choses que des applications similaires dans ce secteur incluent souvent, ou des angles morts probables vu le contexte.
Produis UNIQUEMENT un tableau JSON, chaque élément avec : label (court), description (2 phrases max, pourquoi c'est pertinent ICI, pas en général).
Ne recommande rien qui contredise les contraintes ou la complexité déjà indiquées. Reste concret, pas de généralités vagues.

Activité : ${synthesis.activite}
Besoin réel : ${synthesis.besoinReel}
Fonctionnalités V1 déjà prévues : ${synthesis.fonctionnalitesV1}
Contraintes : ${synthesis.contraintes}
Complexité : ${synthesis.complexite}`;
  try { return extractJSON(await askClaude(prompt, 1500)); } catch { return []; }
}
async function detectPatterns(libraryEntries) {
  const truncated = libraryEntries.length > MAX_PATTERN_LIBRARY_ENTRIES;
  const slice = [...libraryEntries].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, MAX_PATTERN_LIBRARY_ENTRIES);
  const grouped = {};
  slice.forEach((e) => { if (!grouped[e.projectId]) grouped[e.projectId] = { nom: e.projectNom, items: [] }; grouped[e.projectId].items.push(`${e.fieldLabel} : ${e.text}`); });
  const projectIds = Object.keys(grouped);
  if (projectIds.length < 2) return { proposals: [], truncated: false };
  const dump = projectIds.map((id) => `### Projet : ${grouped[id].nom}\n${grouped[id].items.join("\n")}`).join("\n\n");
  const prompt = `Voici des éléments de bibliothèque issus de plusieurs projets différents (${truncated ? `échantillon des ${MAX_PATTERN_LIBRARY_ENTRIES} plus récents, sur ${libraryEntries.length} au total` : "ensemble complet"}). Cherche des patterns qui reviennent sur AU MOINS 2 projets — un vrai mécanisme partagé, pas juste un vocabulaire similaire.
Produis UNIQUEMENT un tableau JSON, chaque élément avec : label, description (2 phrases max), projetsConcernes (liste), niveauConfiance.
niveauConfiance :
- "Hypothèse" si le rapprochement est faible ou surtout lexical.
- "Prometteur" si 2 projets partagent clairement le même mécanisme.
- "Établi" UNIQUEMENT si le pattern est soutenu par au moins 3 projets réellement indépendants (pas juste le même projet compté deux fois) et qu'aucun contre-exemple n'apparaît dans les données fournies. Dans le doute, ne mets jamais "Établi" — reste sur "Prometteur".
Si rien de solide, réponds [].

${dump}`;
  try { return { proposals: extractJSON(await askClaude(prompt, 2000)), truncated }; }
  catch { return { proposals: [], truncated }; }
}
// Chat conversationnel pour affiner le promptAddendum — contrairement aux
// propositions détectées automatiquement (accepter/rejeter en un clic), ici
// la personne peut discuter, préciser, reformuler avant de valider quoi que
// ce soit. askClaude() est sans état : on reconstruit tout l'historique à
// chaque appel. Si l'IA propose un texte concret à intégrer, elle termine
// par une ligne "PROPOSITION: ..." qu'on extrait — jamais appliqué
// automatiquement, seulement affiché pour validation explicite.
async function chatAboutPrompt(history, promptAddendum) {
  const transcript = history.map((m) => `${m.role === "user" ? "Utilisateur" : "Assistant"} : ${m.text}`).join("\n\n");
  const prompt = `Tu aides à affiner les instructions ajoutées à tous les futurs dossiers universels de construction générés par NANDĒM Core (le "promptAddendum"). Discute librement avec la personne pour clarifier ce qu'elle veut préciser, ajuster, ou corriger dans ces instructions.

Instructions actuelles :
${promptAddendum?.trim() || "(vide pour l'instant)"}

Conversation jusqu'ici :
${transcript}

Réponds au dernier message, de façon conversationnelle et concrète. Si la discussion aboutit à une instruction précise à ajouter ou modifier, termine ta réponse par une ligne commençant EXACTEMENT par "PROPOSITION:" suivie du texte proposé (une formulation générale, réutilisable sur d'autres projets, pas spécifique à un seul cas). Sinon, n'ajoute pas cette ligne — continue simplement la discussion.`;
  return await askClaude(prompt, 800);
}

async function synthesizeObservedPatterns(observations) {
  if (!observations.length) return [];
  const dump = observations.slice(0, MAX_PATTERN_LIBRARY_ENTRIES).map((o) => `[ID:${o.id}] [${o.projectNom || "source inconnue"}] ${o.fieldLabel || "Observation"} : ${o.text}`).join("\n");
  const prompt = `Tu es le moteur de formalisation NANDĒM. Analyse toutes les observations ci-dessous, regroupe les doublons et les formulations qui décrivent le même mécanisme. Distingue les vrais mécanismes transversaux des ressemblances superficielles. Signale les contre-exemples ou limites visibles.

Produis UNIQUEMENT un tableau JSON. Chaque proposition doit contenir exactement :
label, synthese, observationsLiees (tableau des ID exacts fournis après ID:), porteeSuggeree (une valeur parmi universel, categorie, famille, secteur, specifique), cibleSuggeree, declencheurs (tableau), exclusions (tableau), instruction, questions (tableau), tests (tableau), niveauConfiance (Hypothèse ou Prometteur), justification.

Ne classe jamais "Établi" à partir de ces observations. Plusieurs projets fictifs similaires ne comptent pas comme preuves indépendantes. Une règle universelle doit réellement être valable pour presque toute application ; sinon choisis une portée plus étroite.

OBSERVATIONS :
${dump}`;
  const result = extractJSON(await askClaude(prompt, 3500));
  if (!Array.isArray(result)) throw new Error("La formalisation n’a pas renvoyé un tableau valide.");
  const scopes = new Set(["universel", "categorie", "famille", "secteur", "specifique"]);
  return result.filter((item) => item && typeof item.label === "string" && typeof (item.instruction || item.synthese) === "string").map((item) => ({
    label: item.label.trim(), synthese: String(item.synthese || "").trim(),
    observationsLiees: Array.isArray(item.observationsLiees) ? item.observationsLiees.filter((id) => typeof id === "string") : [],
    porteeSuggeree: scopes.has(item.porteeSuggeree) ? item.porteeSuggeree : "specifique",
    cibleSuggeree: String(item.cibleSuggeree || "").trim(),
    declencheurs: Array.isArray(item.declencheurs) ? item.declencheurs.map(String).filter(Boolean) : [],
    exclusions: Array.isArray(item.exclusions) ? item.exclusions.map(String).filter(Boolean) : [],
    instruction: String(item.instruction || item.synthese).trim(),
    questions: Array.isArray(item.questions) ? item.questions.map(String).filter(Boolean) : [],
    tests: Array.isArray(item.tests) ? item.tests.map(String).filter(Boolean) : [],
    niveauConfiance: item.niveauConfiance === "Prometteur" ? "Prometteur" : "Hypothèse",
    justification: String(item.justification || "À vérifier").trim(),
  }));
}
// Extraction dédiée à "Importer une idée (Markdown)" — distincte de
// extractFromDocuments (générique, partagée avec Discovery). Ici, la source
// peut être une conversation ou des notes larges qui mélangent le projet à
// plein d'autres sujets (personnels, profonds, sans rapport) : la consigne
// explicite est de ne garder QUE ce qui concerne le projet, et de ne jamais
// résumer ou mentionner le reste.
async function extractAppInfoFromMarkdown(markdownText, allGoals, addendum) {
  const list = allGoals.map((g) => `${g.id} : ${g.question}`).join("\n");
  const prompt = `Le texte ci-dessous peut être une conversation ou des notes larges, qui abordent potentiellement bien plus que le projet d'application ou d'entreprise en cours — des sujets personnels, profonds, ou sans rapport. Ta seule mission : en extraire ce qui concerne CE projet précis, rien d'autre. Ignore tout le reste, même si c'est intéressant ou personnel — ne le résume pas, ne le mentionne pas, ne le laisse influencer aucune réponse.

Sujets du projet à couvrir (id : question) :
${list}
${addendum?.trim() ? `\nRègles supplémentaires apprises sur ce tri, à respecter :\n${addendum.trim()}\n` : ""}
Texte à trier :
"""${markdownText.slice(0, 20000)}"""

Réponds UNIQUEMENT avec un objet JSON {"id": "réponse reformulée", ...}, vide ({}) si rien de pertinent au projet n'est présent. Ne reformule que ce qui concerne clairement le projet — jamais le reste.`;
  try { return extractJSON(await askClaude(prompt, 1500)); } catch { return {}; }
}
// AJOUT (27/08/2026) : import direct d'une appli déjà construite à partir de
// son code source (.jsx) — demandé par le porteur pour enregistrer des
// applis réelles (L'Œil, Foodtruck...) sans repasser par le questionnaire
// manuel. Même principe que extractAppInfoFromMarkdown (lecture par l'IA,
// réponses reformulées en JSON), mais le prompt lit du code plutôt qu'une
// conversation à trier. Le code est plus dense que du texte libre — on
// autorise donc une fenêtre plus large (40000 caractères), mais sur une
// appli volumineuse (l'artefact de NANDĒM Core lui-même fait ~445 Ko, donc
// ~445000 caractères), une grande partie reste hors de vue : statut
// Hypothèse sur la complétude des réponses générées, à relire et compléter
// dans la fiche projet après import — jamais à prendre pour Établi sans
// relecture.
async function extractAppInfoFromCode(codeText, allGoals) {
  const list = allGoals.map((g) => `${g.id} : ${g.question}`).join("\n");
  const prompt = `Voici le code source (React/JSX) d'une application déjà construite. Ta mission : déduire, à partir de ce que révèle réellement ce code (composants, état, textes visibles à l'écran, structure de données, appels réseau, commentaires), les réponses aux questions de diagnostic suivantes — comme si tu interviewais quelqu'un qui décrit son appli déjà faite.

Sujets à couvrir (id : question) :
${list}

Code source (peut être tronqué si l'appli est volumineuse — base-toi uniquement sur ce qui est visible ci-dessous, n'invente rien au-delà) :
"""${codeText.slice(0, 40000)}"""

Réponds UNIQUEMENT avec un objet JSON {"id": "réponse reformulée", ...}. N'inclus que les id pour lesquels le code donne une réponse réellement déductible — laisse de côté ce qui n'est pas visible plutôt que de deviner.`;
  try { return extractJSON(await askClaude(prompt, 1500)); } catch { return {}; }
}
async function chatAboutMdImport(history, addendum) {
  const transcript = history.map((m) => `${m.role === "user" ? "Utilisateur" : "Assistant"} : ${m.text}`).join("\n\n");
  const prompt = `Tu aides à affiner les règles utilisées pour trier un texte large (conversation, brainstorm, notes) et n'en garder que ce qui concerne le projet en cours d'import dans NANDĒM Core — le reste (personnel, profond, sans rapport) doit être ignoré.

Règles actuelles :
${addendum?.trim() || "(vide pour l'instant)"}

Conversation jusqu'ici :
${transcript}

Réponds au dernier message, de façon conversationnelle. Si la discussion aboutit à une règle précise à ajouter (ex. "ignore les discussions sur X", "reconnaît Y comme faisant partie du projet même si non explicite"), termine ta réponse par une ligne commençant EXACTEMENT par "PROPOSITION:" suivie de la règle. Sinon, n'ajoute pas cette ligne — continue simplement la discussion.`;
  return await askClaude(prompt, 800);
}
// Suggestions d'optimisation business — lit un résumé chiffré déjà calculé
// (jamais les détails bruts des projets), propose des pistes concrètes.
// Statut Hypothèse par nature : quelques chiffres ne prouvent rien, ce sont
// des pistes à vérifier, pas des vérités à appliquer aveuglément.
async function suggestBusinessOptimizations(summary) {
  const prompt = `Voici un résumé chiffré de l'activité actuelle d'un créateur d'applications indépendant qui utilise NANDĒM Core pour gérer ses projets clients :
${summary}

Propose 3 à 5 pistes concrètes pour optimiser cette activité (tarification, relance commerciale, priorités, ce qui semble sous-exploité ou négligé). Reste concret et actionnable à partir des chiffres donnés — pas de généralités de coach business, pas de conseil que ces chiffres ne soutiennent pas.
Produis UNIQUEMENT un tableau JSON, chaque élément avec : label (court), description (2-3 phrases, pourquoi c'est pertinent ICI vu les chiffres), niveauConfiance (Hypothèse — jamais Établi à partir de si peu de données).
Si les chiffres sont trop pauvres pour dire quoi que ce soit d'utile, réponds [].`;
  try { return extractJSON(await askClaude(prompt, 1500)); } catch { return []; }
}
async function detectPromptFeedbackPatterns(feedbackEntries) {
  if (feedbackEntries.length < 2) return [];
  const dump = feedbackEntries.map((f) => `Projet "${f.projectNom}" : ${f.text}`).join("\n");
  const prompt = `Voici des retours donnés après usage de plusieurs dossiers de construction avec différents agents ou technologies, sur des projets différents. Cherche des RÉCURRENCES — un même type de manque ou de réussite mentionné sur AU MOINS 2 projets, pas une reformulation de vocabulaire.
Produis UNIQUEMENT un tableau JSON, chaque élément avec : label (court), description (une instruction généralisable à ajouter à tous les futurs prompts, 1-2 phrases), niveauConfiance (Prometteur ou Hypothèse).
Si rien de solide, réponds [].

${dump}`;
  try { return extractJSON(await askClaude(prompt, 1500)); } catch { return []; }
}

async function analyzeQuestionnaireAnswers(samples, goalsByFamily) {
  if (samples.length < 2) return [];
  const prompt = `Tu audites les questionnaires Discovery de NANDĒM. Le questionnaire lui-même fonctionne sans IA : cette analyse est une revue différée, volontaire, destinée à améliorer les formulations pour les prochains utilisateurs.

Pour chaque question, cherche uniquement des problèmes soutenus par plusieurs réponses : incompréhension récurrente, réponses trop vagues malgré une question précise, confusion entre deux questions, information importante souvent absente, formulation trop abstraite ou trop technique. Ne propose pas de changement pour le plaisir de reformuler. Respecte l'ordre universel → famille → secteur et préfère demander un exemple concret plutôt qu'un taux abstrait.

Chaque échantillon contient à la fois les réponses finales (déjà nettoyées) ET la conversation brute correspondante. Utilise la conversation pour repérer un signal que les réponses finales ne montrent plus : une question suivie d'une relance du moteur (reformulation, demande de précision) est un indice de friction réelle sur cette question précise — même si la réponse finale, une fois obtenue, paraît correcte. Une question qui ne déclenche jamais de relance, sur plusieurs échantillons, est un bon signe, pas un problème à corriger.

Produis UNIQUEMENT un tableau JSON. Chaque proposition contient exactement :
goalId, questionnaire (app ou entreprise), label, probleme, preuves (tableau de constats courts sans données personnelles — tu peux citer "relance nécessaire sur X échantillons sur Y" si c'est ce que tu observes), questionActuelle, questionProposee, beneficeAttendu, niveauConfiance (Hypothèse ou Prometteur).

Questions actuelles :
${JSON.stringify(goalsByFamily)}

Échantillon anonymisé de ${samples.length} diagnostics (réponses finales + conversation brute assainie) :
${JSON.stringify(samples).slice(0, 70000)}`;
  const result = extractJSON(await askClaude(prompt, 3500));
  if (!Array.isArray(result)) throw new Error("L’analyse du questionnaire n’a pas renvoyé un tableau valide.");
  const validIds = new Set([...goalsByFamily.app, ...goalsByFamily.entreprise].map((goal) => goal.id));
  return result.filter((item) => item && validIds.has(item.goalId) && ["app", "entreprise"].includes(item.questionnaire) && typeof item.questionProposee === "string" && item.questionProposee.trim()).map((item) => ({
    goalId: item.goalId, questionnaire: item.questionnaire, label: String(item.label || item.goalId),
    probleme: String(item.probleme || "À vérifier"), preuves: Array.isArray(item.preuves) ? item.preuves.map(String).slice(0, 6) : [],
    questionActuelle: String(item.questionActuelle || ""), questionProposee: item.questionProposee.trim(),
    beneficeAttendu: String(item.beneficeAttendu || ""), niveauConfiance: item.niveauConfiance === "Prometteur" ? "Prometteur" : "Hypothèse",
  }));
}

function auditPromptEngineering(promptText) {
  const text = String(promptText || "").trim();
  const lower = text.toLowerCase();
  const checks = [
    { id: "context", label: "Contexte et besoin réel", ok: /contexte|besoin réel|problème/.test(lower), advice: "Décrire le contexte, le problème réel et les utilisateurs." },
    { id: "scope", label: "Périmètre et exclusions", ok: /fonctionnalités v1|périmètre|hors scope|exclusion/.test(lower), advice: "Séparer clairement la V1, le futur et ce qui est exclu." },
    { id: "requirements", label: "Exigences applicables", ok: /exigences|contraintes/.test(lower), advice: "Lister les exigences sélectionnées et leur raison." },
    { id: "acceptance", label: "Critères d’acceptation", ok: /critères d.acceptation|\[ \]|vérifi/.test(lower), advice: "Ajouter des résultats observables permettant de déclarer le travail conforme." },
    { id: "hard-states", label: "États difficiles", ok: /état vide|chargement|erreur|hors-ligne|reprise/.test(lower), advice: "Préciser les états vide, chargement, erreur et reprise pertinents." },
    { id: "workflow", label: "Étapes et point d’arrêt", ok: /étape 1|bêta à valider|validation explicite/.test(lower), advice: "Définir les étapes et le moment où l’agent doit attendre une validation." },
    { id: "neutral", label: "Indépendance technologique", ok: /indépendant|technologie de ton choix|outils les plus adaptés/.test(lower) && !/uniquement avec claude|obligatoirement claude/.test(lower), advice: "Éviter de lier le dossier à une IA ou technologie sans nécessité." },
    { id: "output", label: "Livrables attendus", ok: /livrable|présente ce qui|dossier|source json|markdown/.test(lower), advice: "Dire précisément ce que l’agent doit rendre et sous quelle forme." },
  ];
  const ambiguityMarkers = ["non renseigné", "non générée", "à déterminer", "à préciser", "à confirmer"];
  const ambiguities = ambiguityMarkers.filter((marker) => lower.includes(marker));
  const passed = checks.filter((check) => check.ok).length;
  const specificity = Math.min(20, Math.round(new Set(normalizedWords(text)).size / 12));
  const score = Math.min(100, Math.round((passed / checks.length) * 80 + specificity - Math.min(15, ambiguities.length * 3)));
  return { score, checks, ambiguities, words: text.split(/\s+/).filter(Boolean).length, status: score >= 85 ? "Solide" : score >= 65 ? "À renforcer" : "Insuffisant" };
}

// Extrait de verifyGeneratedResult (27/08/2026) pour être réutilisable sans
// appel IA — permet de copier la même demande de vérification et de la
// coller dans n'importe quel autre outil/IA, comme le "Mode Assistant bêta"
// déjà utilisé pour la synthèse du diagnostic. Le texte n'a pas changé.
function buildVerificationPrompt(referencePrompt, generatedResult) {
  return `Tu es le vérificateur qualité interne de NANDĒM. Compare le résultat produit avec le dossier de construction de référence. Ne récompense pas le style ou la longueur : cherche des preuves concrètes de conformité. Signale les affirmations non démontrées, les exigences oubliées, les ajouts hors périmètre et les risques. Si le résultat ne contient pas le code ou les preuves nécessaires, dis-le explicitement.

Réponds UNIQUEMENT avec un objet JSON : {"score":0-100,"verdict":"Conforme|Partiellement conforme|Non conforme|Preuves insuffisantes","conformites":[...],"ecarts":[{"exigence":"...","constat":"...","gravite":"critique|important|mineur","correction":"..."}],"horsPerimetre":[...],"testsAExecuter":[...],"instructionCorrective":"..."}.

DOSSIER DE RÉFÉRENCE :
${String(referencePrompt).slice(0, 40000)}

RÉSULTAT À VÉRIFIER :
${String(generatedResult).slice(0, 50000)}`;
}
// Demande de compte-rendu (27/08/2026) — répond à un besoin réel du porteur :
// une fois l'IA constructrice arrivée au bout, il faut un prompt à lui donner
// pour obtenir un rapport assez précis et complet pour remplir "Résultat à
// vérifier" sans devoir enchaîner les relances ("je veux pas avoir à trop
// devoir lui demander d'ajouter des choses"). Déterministe, sans appel IA —
// copiable immédiatement, comme buildVerificationPrompt.
function buildReportRequestPrompt() {
  return `Tu viens de terminer (ou d'avancer significativement sur) la construction de cette application à partir du dossier fourni. Fais un compte-rendu précis et complet de ce que tu as réellement fait — je préfère un rapport détaillé et honnête plutôt que d'avoir à te redemander des précisions ensuite.

Décris, dans l'ordre :
1. La liste des fichiers créés ou modifiés.
2. Les fonctionnalités effectivement implémentées ET vérifiées par toi (pas seulement prévues ou censées marcher).
3. Les écarts avec la demande initiale : ce qui n'a pas pu être fait, ce qui a été fait différemment, et pourquoi.
4. Les décisions que tu as prises sans validation explicite de ma part.
5. Les limites connues, bugs non résolus, parties non testées ou approximatives.

Sois factuel : n'affirme pas qu'une fonctionnalité marche si tu ne l'as pas réellement vérifiée. Si tu n'es pas sûr de quelque chose, dis-le clairement plutôt que de l'affirmer. Ne résume pas trop court — un point oublié ici est un point que je ne pourrai pas vérifier ensuite.`;
}
// Validation partagée entre le chemin IA intégrée (verifyGeneratedResult) et
// le chemin manuel (coller la réponse d'un autre outil) — même exigence de
// forme dans les deux cas, pour ne pas enregistrer un rapport la moitié
// incomplet selon le chemin utilisé.
function parseVerificationResponse(result) {
  if (!result || typeof result !== "object" || !Number.isFinite(Number(result.score))) throw new Error("La réponse ne contient pas un rapport valide (score manquant ou non numérique).");
  return { score: Math.max(0, Math.min(100, Number(result.score))), verdict: String(result.verdict || "Preuves insuffisantes"), conformites: Array.isArray(result.conformites) ? result.conformites.map(String) : [], ecarts: Array.isArray(result.ecarts) ? result.ecarts : [], horsPerimetre: Array.isArray(result.horsPerimetre) ? result.horsPerimetre.map(String) : [], testsAExecuter: Array.isArray(result.testsAExecuter) ? result.testsAExecuter.map(String) : [], instructionCorrective: String(result.instructionCorrective || "") };
}
async function verifyGeneratedResult(referencePrompt, generatedResult) {
  const prompt = buildVerificationPrompt(referencePrompt, generatedResult);
  return parseVerificationResponse(extractJSON(await askClaude(prompt, 4000)));
}

function buildBuilderDebriefPrompt(realization) {
  const requirements = (realization.requirementsSnapshot || []).map((item) => `- ${item.label} : ${item.instruction}`).join("\n");
  return `Tu viens de participer à la réalisation d’une application à partir du dossier ci-dessous. NANDĒM cherche à améliorer son moteur de préparation de projets, pas à obtenir une justification flatteuse de ton travail.

Réponds avec franchise et uniquement à partir de ce que tu as réellement fait ou constaté. Distingue les faits, les déductions et les incertitudes. N’invente aucune preuve.

Analyse les points suivants :
1. Quelles parties du dossier étaient suffisamment claires et directement exploitables ?
2. Quelles informations manquaient, étaient ambiguës ou sont arrivées trop tard ?
3. Quelles exigences ont eu le plus d’effet sur la qualité du résultat ?
4. Quelles exigences étaient inutiles, contradictoires ou mal adaptées à ce projet ?
5. Quelles décisions as-tu dû prendre sans validation du porteur ?
6. Quels problèmes, reprises ou erreurs auraient pu être évités par une meilleure question en amont ?
7. Quels tests ou critères d’acceptation manquaient ?
8. Quelle amélioration précise proposes-tu au questionnaire, aux patterns ou au prompt moteur ?
9. Cette amélioration semble-t-elle universelle, propre à une famille de projets, ou spécifique à ce projet ? Pourquoi ?
10. Quel contre-exemple empêcherait de généraliser cette amélioration ?

Termine par un objet JSON valide entre les balises <nandem_learning> et </nandem_learning> avec cette structure :
{"constats":[...],"informations_manquantes":[...],"exigences_utiles":[...],"exigences_inadaptees":[...],"tests_manquants":[...],"propositions":[{"titre":"...","description":"...","portee":"universelle|famille|projet","famille":"... ou vide","preuve":"...","contre_exemple":"...","confiance":"faible|moyenne|forte"}]}

CONTEXTE FIGÉ DU CYCLE
Outil déclaré : ${realization.provider}
Objectif : ${realization.objective}

EXIGENCES SÉLECTIONNÉES
${requirements || "Aucune exigence enregistrée"}

DOSSIER TRANSMIS
${String(realization.promptSnapshot || "").slice(0, 30000)}

RETOUR HUMAIN ET ÉCARTS DÉJÀ CONSTATÉS
${String(realization.freeFeedback || "Aucun retour libre").slice(0, 6000)}
${String(realization.initialVerification?.instructionCorrective || "Aucune vérification IA").slice(0, 6000)}`;
}

async function synthesizeBuilderDebrief(realization, response) {
  const prompt = `Tu es le moteur de formalisation NANDĒM. Analyse le débrief ci-dessous sans prendre les affirmations de l’IA constructrice pour des vérités établies. Produis une proposition courte qui pourra entrer dans Observer et être comparée à d’autres projets. Mentionne la portée supposée, la preuve disponible, les incertitudes et le contre-exemple à rechercher.

Réponds UNIQUEMENT avec un objet JSON : {"learningProposal":"...","scope":"universelle|famille|projet","confidence":"Hypothèse|Prometteur","evidence":[...],"uncertainties":[...],"counterExample":"..."}.

QUESTIONNAIRE ENVOYÉ :
${buildBuilderDebriefPrompt(realization).slice(0, 30000)}

RÉPONSE DE L’IA CONSTRUCTRICE :
${String(response).slice(0, 40000)}`;
  const result = extractJSON(await askClaude(prompt, 2500));
  if (!result || typeof result.learningProposal !== "string" || !result.learningProposal.trim()) throw new Error("La synthèse du débrief n’a pas renvoyé une proposition valide.");
  return {
    learningProposal: result.learningProposal.trim(), scope: ["universelle", "famille", "projet"].includes(result.scope) ? result.scope : "projet",
    confidence: result.confidence === "Prometteur" ? "Prometteur" : "Hypothèse",
    evidence: Array.isArray(result.evidence) ? result.evidence.map(String) : [], uncertainties: Array.isArray(result.uncertainties) ? result.uncertainties.map(String) : [],
    counterExample: String(result.counterExample || ""), synthesizedAt: new Date().toISOString(),
  };
}
const MAX_PATTERN_PROJECTS = 20;
async function detectPatternsFromProjects(projects) {
  if (projects.length < 2) return { proposals: [], scanned: projects.length };
  const dump = projects.map((p) => `### Projet : ${p.nom}
Activité : ${p.synthesis.activite}
Fonctionnalités V1 : ${p.synthesis.fonctionnalitesV1}
Objets métier : ${p.synthesis.objetsMetier}
Processus métier : ${p.synthesis.processusMetier}
Contraintes : ${p.synthesis.contraintes}`).join("\n\n");
  const prompt = `Voici le cahier des charges de plusieurs projets différents, analysés directement (pas une sélection manuelle). Cherche des patterns qui reviennent sur AU MOINS 2 projets — un vrai mécanisme partagé (même besoin, même structure de données, même fonctionnalité récurrente), pas juste un vocabulaire similaire.
Produis UNIQUEMENT un tableau JSON, chaque élément avec : label, description (2 phrases max), projetsConcernes (liste des noms), niveauConfiance.
niveauConfiance :
- "Hypothèse" si le rapprochement est faible ou surtout lexical.
- "Prometteur" si 2 projets partagent clairement le même mécanisme.
- "Établi" UNIQUEMENT si au moins 3 projets réellement indépendants (secteurs ou porteurs différents, pas juste 3 fois le même) partagent le mécanisme et qu'aucun contre-exemple n'apparaît dans les données fournies. Dans le doute, reste sur "Prometteur".
Si rien de solide, réponds [].

${dump}`;
  try { return { proposals: extractJSON(await askClaude(prompt, 2000)), scanned: projects.length }; }
  catch { return { proposals: [], scanned: projects.length }; }
}

const SYNTHESIS_FIELDS = [
  ["resume", "Résumé"], ["besoinReel", "Besoin réel"], ["activite", "Activité"],
  ["utilisateurs", "Utilisateurs"], ["objetsMetier", "Objets métier"], ["processusMetier", "Processus métier"],
  ["informationsManipulees", "Informations manipulées"], ["difficultes", "Difficultés"], ["frustrations", "Frustrations"],
  ["opportunitesAutomatisation", "Opportunités d'automatisation"], ["fonctionnalitesV1", "Fonctionnalités V1"],
  ["fonctionnalitesFutures", "Fonctionnalités futures"], ["contraintes", "Contraintes"], ["priorites", "Priorités"],
  ["complexite", "Complexité estimée"], ["questionsOuvertes", "Questions encore ouvertes"],
];
const STATE_STYLES = {
  confirme: { dot: "bg-amber-400", ring: "ring-amber-400/40", text: "text-amber-300" },
  partiel: { dot: "bg-violet-400", ring: "ring-violet-400/30", text: "text-violet-300" },
  inconnu: { dot: "bg-slate-600", ring: "ring-slate-600/20", text: "text-slate-500" },
};
const CODE_EXTENSIONS = [".js", ".jsx", ".ts", ".tsx", ".py", ".html", ".css", ".json", ".java", ".rb", ".php", ".go", ".swift", ".kt", ".c", ".cpp", ".cs", ".vue", ".sql"];
function isCodeFile(filename) { const lower = filename.toLowerCase(); return CODE_EXTENSIONS.some((ext) => lower.endsWith(ext)); }
async function analyzeExistingCode(codeText) {
  const prompt = `Tu es en Mode Reprise (pas Mode Création) : du code existe déjà, ta mission est de le comprendre avant de suggérer quoi que ce soit — jamais réécrire ou juger sans preuve mesurable.
Analyse ce code et produis un résumé en Markdown, en français, avec ces sections :
## Ce qui est déjà construit (fonctionnalités et écrans identifiés)
## Architecture détectée (techno, structure, approche)
## Points d'optimisation possibles (avec la raison précise, pas de généralité du type "améliore la performance")
## Ce qui semble intentionnel — à ne pas casser sans preuve
Reste factuel, base-toi uniquement sur ce que le code montre réellement.

Code fourni :
${codeText.slice(0, 60000)}`;
  return await askClaude(prompt, 2200);
}
const CATEGORIES = ["Entreprise", "App"];
const STATUTS = ["Exploration", "Mise en place", "Consolidation", "Actif"];
const NIVEAUX_PREUVE = ["Établi", "Prometteur", "Hypothèse", "Inconnu"];
// Statut de validation d'un élément de bibliothèque — distinct du niveau de
// généricité (LIB_GENERICITE). C'est toi qui juges où en est réellement la
// preuve, jamais le moteur seul (cohérent avec "rien n'entre automatiquement
// dans Optimisation sans validation").
const PATTERN_STATUTS = ["À valider", "Preuve à avoir", "À faire", "Établi"];
const PATTERN_STATUT_STYLE = {
  "À valider": "text-slate-400 border-slate-600/40",
  "Preuve à avoir": "text-amber-300 border-amber-400/30",
  "À faire": "text-violet-300 border-violet-500/30",
  "Établi": "text-emerald-300 border-emerald-500/30",
};
const LIB_GENERICITE = [
  { id: "specifique", label: "Spécifique à ce projet", color: "text-slate-400 border-slate-600/40" },
  { id: "metier", label: "Valable pour ce métier", color: "text-sky-300 border-sky-500/30" },
  { id: "transversal", label: "Transversal (plusieurs métiers)", color: "text-violet-300 border-violet-500/30" },
  { id: "generique", label: "Candidat au moteur générique", color: "text-amber-300 border-amber-400/30" },
];
// Le niveau de généricité est un jugement difficile à porter dans l'instant
// (spécifique à ce projet ? valable pour tout un métier ? transversal ?) —
// l'IA propose une suggestion avec sa justification, mais ne choisit jamais
// à la place de la personne : les quatre boutons restent cliquables, la
// suggestion n'est qu'une pré-sélection modifiable.
async function suggestGenericiteLevel(text, fieldLabel) {
  const prompt = `Voici un élément qu'une personne veut ajouter à sa bibliothèque de connaissances réutilisables (NANDĒM Optimisation). Juge son niveau de généricité probable.

Champ concerné : ${fieldLabel || "non précisé"}
Contenu : "${text}"

Niveaux possibles :
- specifique : ne concerne que ce projet précis, aucune raison de penser que ça se retrouve ailleurs.
- metier : probablement valable pour d'autres projets du même métier/secteur, pas au-delà.
- transversal : probablement valable sur plusieurs métiers différents.
- generique : mécanisme probablement universel, candidat à devenir une règle du moteur.

Réponds UNIQUEMENT avec un objet JSON : {"niveau": "specifique|metier|transversal|generique", "raison": "une phrase courte"}. Dans le doute, reste sur "specifique" — ne surestime jamais la portée à partir d'un seul exemple.`;
  try { return extractJSON(await askClaude(prompt, 300)); } catch { return null; }
}
const LIB_TYPES = [
  { id: "connaissance", label: "Connaissance" },
  { id: "composant", label: "Composant réutilisable" },
  { id: "decision", label: "Décision" },
  { id: "preuve", label: "Preuve" },
];

const GlobalStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&display=swap');
    .font-display { font-family: 'Fraunces', ui-serif, Georgia, serif; }
    .font-sans { font-family: 'Inter', ui-sans-serif, system-ui, sans-serif; }
    .font-mono-data { font-family: ui-monospace, 'SF Mono', Menlo, monospace; }
    .theme-dark {
      --bg-app: #12141A; --bg-panel: #1A1D24;
      --surface: rgba(255,255,255,0.03); --surface-2: rgba(255,255,255,0.04); --surface-3: rgba(255,255,255,0.06);
      --border: rgba(255,255,255,0.10); --border-soft: rgba(255,255,255,0.05); --border-strong: rgba(255,255,255,0.20);
      --text-primary: #EDE9E3;
    }
    .theme-light {
      --bg-app: #FAF9F6; --bg-panel: #FFFFFF;
      --surface: rgba(0,0,0,0.035); --surface-2: rgba(0,0,0,0.05); --surface-3: rgba(0,0,0,0.07);
      --border: rgba(0,0,0,0.12); --border-soft: rgba(0,0,0,0.06); --border-strong: rgba(0,0,0,0.22);
      --text-primary: #1A1D24;
    }
    .bg-app { background-color: var(--bg-app); }
    .bg-panel { background-color: var(--bg-panel); }
    .bg-surface { background-color: var(--surface); }
    .bg-surface-2 { background-color: var(--surface-2); }
    .bg-surface-3 { background-color: var(--surface-3); }
    .border-app { border-color: var(--border); }
    .border-app-soft { border-color: var(--border-soft); }
    .border-app-strong { border-color: var(--border-strong); }
    .text-app { color: #12141A; }
    .text-cream { color: var(--text-primary); }
    .text-9 { font-size: 9px; }
    .text-10 { font-size: 10px; }
    .text-11 { font-size: 11px; }
    .text-12 { font-size: 12px; }
    .text-13 { font-size: 13px; }
    .text-14 { font-size: 14px; }
    .max-w-85 { max-width: 85%; }
    .h-85vh { height: 85vh; }
    .h-header-offset { height: calc(100vh - 65px); }
  `}</style>
);

function compressImage(file, maxWidth = 480, quality = 0.6) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function buildFullExportText(project) {
  const s = project.discovery?.synthesis; const a = project.discovery?.answers || {};
  let text = `ARCHIVE PROJET — ${project.nom}\nCatégorie : ${project.categorie} · Étape commerciale : ${project.pipeline || "Prospect"}\n`;
  if (project.client?.nom || project.client?.email) text += `Contact : ${project.client.nom || "nom non précisé"}${project.client.email ? ` — ${project.client.email}` : ""}${project.client.telephone ? ` · ${project.client.telephone}` : ""}\n`;
  if (project.entreprise?.nom) text += `Entreprise : ${project.entreprise.nom} (${project.entreprise.secteur || "secteur non précisé"}, ${project.entreprise.taille || "taille non précisée"})\n`;
  if (project.finance?.devis != null || project.finance?.paye != null) text += `Finances : devis ${project.finance.devis ?? "non chiffré"} € · encaissé ${project.finance.paye ?? 0} €${project.finance.note ? ` (${project.finance.note})` : ""}\n`;
  if (project.tempsPasse?.length) text += `Temps passé : ${project.tempsPasse.reduce((sum, e) => sum + (Number(e.heures) || 0), 0)} h (${project.tempsPasse.length} ligne${project.tempsPasse.length > 1 ? "s" : ""})\n`;
  if (project.facture?.numero || project.facture?.montant != null) text += `Facture ${project.facture.numero || "(sans numéro)"} : ${project.facture.montant ?? "montant non précisé"} €${project.facture.date ? ` — ${new Date(project.facture.date).toLocaleDateString("fr-FR")}` : ""}\n`;
  text += `Créé le : ${new Date(project.date).toLocaleDateString("fr-FR")}\n\n--- RÉPONSES BRUTES DU DIAGNOSTIC ---\n`;
  Object.entries(a).filter(([id]) => id !== "commentaireLibre").forEach(([, ans]) => { text += `${ans.label} : ${ans.text}\n`; });
  if (a.commentaireLibre?.text) text += `Remarque libre : ${a.commentaireLibre.text}\n`;
  if (s) { text += `\n--- CAHIER DES CHARGES ---\n`; SYNTHESIS_FIELDS.forEach(([k, label]) => { text += `\n${label}\n${s[k] || "Non renseigné"}\n`; }); }
  if (project.proposal) text += `\n--- PROPOSITION COMMERCIALE ---\n${project.proposal}\n`;
  if (project.conception) text += `\n--- CONCEPTION TECHNIQUE ---\n${project.conception}\n`;
  if (project.validatedIdeas?.length) text += `\n--- SUGGESTIONS VALIDÉES ---\n${project.validatedIdeas.map((v) => `- ${v.label} : ${v.description}`).join("\n")}\n`;
  if (project.notesComplementaires?.trim()) text += `\n--- NOTES COMPLÉMENTAIRES ---\n${project.notesComplementaires.trim()}\n`;
  if (project.codeExistant) text += `\n--- CODE EXISTANT (Mode Reprise) ---\n${project.codeExistant}\n`;
  if (project.buildHistory?.length) { text += `\n--- HISTORIQUE DE CONSTRUCTION ---\n`; project.buildHistory.forEach((h) => { text += `(${new Date(h.date).toLocaleDateString("fr-FR")}) ${h.text}\n`; }); }
  if (project.realizations?.length) { text += `\n--- CYCLES DE RÉALISATION ---\n`; project.realizations.forEach((r, index) => { text += `\nCycle ${project.realizations.length - index} — ${new Date(r.createdAt).toLocaleDateString("fr-FR")} — ${r.status}\nOutil : ${r.provider}\nObjectif : ${r.objective}\nScore initial : ${r.initialVerification?.score ?? "non vérifié"}\nScore final : ${r.finalVerification?.score ?? "non vérifié"}\nApprentissage : ${r.learningProposal || "aucun"}\n`; }); }
  if (project.documents?.length) { text += `\n--- DOCUMENTS ---\n`; project.documents.forEach((d) => { text += `[${d.type}] ${d.label} — ${new Date(d.date).toLocaleDateString("fr-FR")}${d.type === "note" ? "\n" + d.text : ""}\n`; }); }
  return text;
}
function buildPortableBuildPackage(project, addendum, engineRequirements = []) {
  const selection = selectRequirementsForProject(project, engineRequirements);
  const s = project.discovery.synthesis;
  return {
    format: "nandem-build-package",
    version: 1,
    generatedAt: new Date().toISOString(),
    providerNeutral: true,
    project: { id: project.id, nom: project.nom, categorie: project.categorie, secteur: project.secteurTag || "", synthesis: s, answers: project.discovery.answers || {}, conception: project.conception || "", validatedIdeas: project.validatedIdeas || [], notes: project.notesComplementaires || "", existingCode: project.codeExistant || "", buildHistory: project.buildHistory || [] },
    qualityCharter: UNIVERSAL_QUALITY_CHARTER,
    selectedRequirements: selection.selected.map(({ requirement, reason }) => ({ ...requirement, selectionReason: reason })),
    excludedRequirements: selection.rejected.map(({ requirement, reason }) => ({ id: requirement.id, label: requirement.label, reason })),
    methodConstraints: detectMethodConstraints(s),
    accumulatedRules: addendum || "",
    workflow: UNIVERSAL_BUILD_WORKFLOW,
    defaultRelevanceChecks: DEFAULT_RELEVANCE_CHECKS,
  };
}

function buildUniversalBuildPrompt(project, addendum, engineRequirements = []) {
  const s = project.discovery.synthesis;
  const answers = project.discovery.answers || {};
  const buildPackage = buildPortableBuildPackage(project, addendum, engineRequirements);

  // 1. Réponses sectorielles sensibles : injectées TELLES QUELLES, jamais
  // dépendantes de si la synthèse IA a bien pensé à les recopier dans
  // "contraintes". Pour santé/juridique/enfance/finance, c'est justement
  // l'information qui ne doit jamais se perdre.
  const sectorAnswers = Object.entries(answers).filter(([id]) => SECTOR_RAW_LABELS[id] && answers[id]?.text);
  const sectorBlock = sectorAnswers.length
    ? `\n## Contraintes sectorielles (réponses brutes de la personne — ne pas résumer, respecter telles quelles)\n${sectorAnswers.map(([id, a]) => `- ${SECTOR_RAW_LABELS[id]} : ${a.text}`).join("\n")}`
    : "";

  // 2. Préférence technique — réponse brute, pas reformulée non plus (une
  // stack ou une contrainte de dépôt existant n'a pas besoin d'interprétation).
  const stackBlock = answers.stack?.text
    ? `\n## Préférence technique indiquée par la personne\n${answers.stack.text}`
    : "";

  // 3. Contraintes Nandēm Method déjà validées, détectées automatiquement à
  // partir du cahier des charges — voir METHOD_CONSTRAINT_LIBRARY. Ne
  // remplace pas le jugement de la personne, mais évite de dépendre
  // uniquement de la mémoire de l'IA de synthèse pour les faire apparaître.
  const methodConstraints = detectMethodConstraints(s);
  const methodBlock = methodConstraints.length
    ? `\n## Contraintes Nandēm Method déjà validées (détectées automatiquement à partir de ce projet — à vérifier, pas à appliquer aveuglément)\n${methodConstraints.map((c) => `- ${c.text}`).join("\n")}`
    : "";

  const requirementBlock = buildPackage.selectedRequirements.length
    ? `\n## Exigences sélectionnées par le moteur pour ce projet\n${buildPackage.selectedRequirements.map((r) => `- **${r.label}** — ${r.instruction}\n  Raison : ${r.selectionReason}${r.tests?.length ? `\n  Vérifications : ${r.tests.join(" ; ")}` : ""}`).join("\n")}`
    : "\n## Exigences sélectionnées par le moteur pour ce projet\nAucune exigence contextuelle supplémentaire n’a encore été validée.";

  const qualityBlock = `\n## ${UNIVERSAL_QUALITY_CHARTER.title}\n${UNIVERSAL_QUALITY_CHARTER.principle}\n\nRègles opérationnelles :\n${UNIVERSAL_QUALITY_CHARTER.rules.map((rule) => `- ${rule}`).join("\n")}\n\nCritères d’acceptation avant de déclarer la version prête :\n${UNIVERSAL_QUALITY_CHARTER.acceptance.map((rule) => `- [ ] ${rule}`).join("\n")}`;
  const relevanceBlock = `\n## Contrôles de pertinence issus des simulations NANDĒM\nPour chacun des contrôles suivants, indique brièvement « applicable » ou « non applicable » avec la raison. N’implémente rien uniquement parce que le contrôle existe ; transforme-le en exigence seulement si le besoin réel du projet le justifie.\n${DEFAULT_RELEVANCE_CHECKS.map((item) => `- **${item.label}** — ${item.question}`).join("\n")}`;

  // 5. Ce qui a déjà été construit sur ce projet, pour un prompt de suivi
  // (ajout de fonctionnalité) plutôt que de repartir de zéro à chaque fois.
  const historyBlock = project.buildHistory?.length
    ? `\n## Déjà construit sur ce projet — ne pas repartir de zéro, ajoute/modifie seulement ce qui suit\n${project.buildHistory.map((h) => `- (${new Date(h.date).toLocaleDateString("fr-FR")}) ${h.text}`).join("\n")}`
    : "";

  // 7. Rappel de la checklist de déploiement déjà établie (skill nandem-app-builder).
  const deploymentBlock = `\n## Si déploiement CodeSandbox\n- Tailwind CSS n'est pas inclus par défaut : ajouter <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script> dans le <head>.\n- Vérifier la version de \`lucide-react\` dans package.json (le template par défaut peut être obsolète et faire planter les icônes).\n- Tester tous les écrans et tous les rôles, pas seulement l'écran d'accueil.`;

  return `# Dossier universel de construction — ${project.nom}
Issu d'un diagnostic Nandēm Discovery. Toutes les informations ci-dessous sont déjà confirmées — pose uniquement les questions qui ne trouvent pas de réponse ici.

Ce dossier est indépendant de tout fournisseur d’IA, agent de code, framework ou technologie future. Utilise les outils les plus adaptés au contexte confirmé, sans introduire de dépendance propriétaire inutile.

## Contexte
${s.resume}
## Besoin réel
${s.besoinReel}
## Utilisateurs
${s.utilisateurs}
## Fonctionnalités V1
${s.fonctionnalitesV1}
## Fonctionnalités futures (hors scope V1)
${s.fonctionnalitesFutures}
## Contraintes
${s.contraintes}
## Complexité estimée
${s.complexite}
${sectorBlock}${stackBlock}${methodBlock}${requirementBlock}${qualityBlock}${relevanceBlock}
## Conception technique proposée
${project.conception || "Non générée"}
${project.validatedIdeas?.length ? `\n## Suggestions validées à inclure\n${project.validatedIdeas.map((v) => `- ${v.label} : ${v.description}`).join("\n")}` : ""}
${project.notesComplementaires?.trim() ? `\n## Notes complémentaires ajoutées par la personne\n${project.notesComplementaires.trim()}` : ""}
${project.codeExistant ? `\n## Code existant fourni — MODE REPRISE\n${project.codeExistant}\n\nNe réécris pas ce qui fonctionne déjà sans raison mesurable. Comprends d'abord, améliore ensuite.` : ""}
${historyBlock}
${addendum?.trim() ? `\n## Leçons accumulées sur d'autres prompts (à respecter)\n${addendum.trim()}` : ""}
${deploymentBlock}

---
Procède en deux temps, jamais en un seul bloc complet d'un coup :

${UNIVERSAL_BUILD_WORKFLOW.map((step, index) => `## Étape ${index + 1} — ${step.title}\n${step.instruction}`).join("\n\n")}

Si un point reste ambigu à n'importe quelle étape, pose une seule question ciblée avant de continuer plutôt que de supposer.`;
}
function buildClientEmailBody(answers, synthesis) {
  let body = `Nouveau diagnostic reçu via NANDĒM Discovery.\n\n--- RÉPONSES ---\n`;
  Object.entries(answers).filter(([id]) => id !== "commentaireLibre").forEach(([, a]) => { body += `${a.label} : ${a.text}\n`; });
  if (answers.commentaireLibre?.text) body += `Remarque libre : ${answers.commentaireLibre.text}\n`;
  if (synthesis) { body += `\n--- SYNTHÈSE ---\n`; SYNTHESIS_FIELDS.forEach(([k, label]) => { body += `\n${label}\n${synthesis[k] || "Non renseigné"}\n`; }); }
  return body;
}
function formatTranscript(messages) {
  return messages.map((m) => `${m.role === "user" ? "Toi" : "NANDĒM"} : ${m.text}`).join("\n\n");
}

// ---------------------------------------------------------------------------

function Onboarding({ onFinish, theme }) {
  const [step, setStep] = useState(0);
  const last = step === ONBOARDING_STEPS.length - 1;
  return (
    <div className={`fixed inset-0 bg-app z-50 flex flex-col font-sans text-cream ${theme === "light" ? "theme-light" : "theme-dark"}`}>
      <GlobalStyle />
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <div className="w-12 h-12 rounded-full bg-amber-400/10 border border-amber-400/30 flex items-center justify-center mb-6"><Sparkles size={20} className="text-amber-400" /></div>
        <h2 className="font-display text-2xl mb-3">{ONBOARDING_STEPS[step].title}</h2>
        <p className="text-slate-400 text-sm leading-relaxed max-w-xs">{ONBOARDING_STEPS[step].text}</p>
        <div className="flex gap-1.5 mt-8">{ONBOARDING_STEPS.map((_, i) => (<span key={i} className={`w-1.5 h-1.5 rounded-full ${i === step ? "bg-amber-400" : "bg-surface-3"}`} />))}</div>
      </div>
      <div className="px-6 py-6 flex items-center justify-between">
        <button onClick={onFinish} className="text-13 text-slate-500">Passer</button>
        <div className="flex gap-2">
          {step > 0 && <button onClick={() => setStep(step - 1)} className="text-13 text-slate-400 px-4 py-2">Précédent</button>}
          <button onClick={() => (last ? onFinish() : setStep(step + 1))} className="text-13 bg-amber-400 text-app px-5 py-2 rounded-full font-medium">{last ? "Commencer" : "Suivant"}</button>
        </div>
      </div>
    </div>
  );
}

function DiscoveryFlow({ onComplete, categorie, onCodeExistant, customGoals = [], questionOverrides = [] }) {
  // Le questionnaire complet dépend du type de projet : une société et une
  // application n'ont pas les mêmes besoins d'information (voir GOALS_ENTREPRISE
  // vs GOALS_APP plus haut).
  const activeGoals = applyQuestionOverrides(getGoalsFor(categorie), categorie, questionOverrides);
  const activeCustomGoals = applyQuestionOverrides(customGoals, categorie, questionOverrides);
  const [entryMode, setEntryMode] = useState(null); // null (choix) | "text" | "documents"
  const [messages, setMessages] = useState([]);
  const [answers, setAnswers] = useState({});
  const [awaitingGoalId, setAwaitingGoalId] = useState(null);
  const [input, setInput] = useState("");
  const [pendingRelance, setPendingRelance] = useState(false);
  const [busy, setBusy] = useState(false);
  const [synthesizing, setSynthesizing] = useState(false);
  const [openCommentAsked, setOpenCommentAsked] = useState(false);
  const [awaitingOpenComment, setAwaitingOpenComment] = useState(false);
  const [extraGoals, setExtraGoals] = useState([]);
  const [docFiles, setDocFiles] = useState([]);
  const [docNotes, setDocNotes] = useState("");
  const [processingDocs, setProcessingDocs] = useState(false);
  const [earlyFinishWarning, setEarlyFinishWarning] = useState(null);
  const [transcriptFallback, setTranscriptFallback] = useState(null);
  const [transcriptCopied, setTranscriptCopied] = useState(false);
  async function copyTranscript() {
    const text = formatTranscript(messages);
    try {
      if (!navigator.clipboard) throw new Error("indisponible");
      await navigator.clipboard.writeText(text);
      setTranscriptCopied(true); setTimeout(() => setTranscriptCopied(false), 1800);
    } catch { setTranscriptFallback(text); }
  }
  const scrollRef = useRef(null);
  const answerRef = useRef(null);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, synthesizing]);

  function knowledgeState() { const list = [...activeGoals, ...activeCustomGoals, ...extraGoals]; return list.map((g) => { const a = answers[g.id]; return { ...g, confidence: a ? a.confidence : 0, state: a ? a.state : "inconnu" }; }); }
  function pickNextGoal(current, goalsList) {
    const candidates = goalsList.filter((g) => { if (current[g.id] && current[g.id].state === "confirme") return false; return g.dependsOn.every((d) => current[d]); });
    if (!candidates.length) return null;
    candidates.sort((a, b) => b.importance / b.cost - a.importance / a.cost);
    return candidates[0];
  }
  async function finish(finalAnswers, finalMessages) {
    setSynthesizing(true);
    try { onComplete(finalAnswers, await buildSynthesis(finalAnswers, finalMessages), null, finalMessages); }
    catch (e) { onComplete(finalAnswers, null, `La synthèse a échoué (${e.message}) — les réponses restent disponibles.`, finalMessages); }
  }
  function askOpenComment(current, currentMessages) {
    setAnswers(current);
    setOpenCommentAsked(true);
    setAwaitingOpenComment(true);
    setMessages([...currentMessages, { role: "engine", text: "Une dernière chose, facultative : quelque chose à ajouter, une remarque, un point que je n'ai pas demandé ?" }]);
  }
  function endOfGoals(current, currentMessages) {
    if (!openCommentAsked) return askOpenComment(current, currentMessages);
    return finish(current, currentMessages);
  }

  function startTextMode() {
    setEntryMode("text");
    setMessages([{ role: "engine", text: questionFor(activeGoals[0]) }]);
    setAwaitingGoalId(activeGoals[0].id);
  }

  function continueAfterAnswers(mergedAnswers, currentExtraGoals, baseMessages, ackMessage) {
    const fullList = [...activeGoals, ...activeCustomGoals, ...currentExtraGoals];
    const withAck = ackMessage ? [...baseMessages, { role: "engine", text: ackMessage }] : baseMessages;
    const next = pickNextGoal(mergedAnswers, fullList);
    setAnswers(mergedAnswers);
    if (!next) { setMessages(withAck); return endOfGoals(mergedAnswers, withAck); }
    setAwaitingGoalId(next.id);
    setMessages([...withAck, { role: "engine", text: questionFor(next) }]);
  }

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }
  function addDocFiles(fileList) { setDocFiles((prev) => [...prev, ...Array.from(fileList)]); }
  function removeDocFile(idx) { setDocFiles((prev) => prev.filter((_, i) => i !== idx)); }

  async function analyzeDocuments() {
    if (!docFiles.length && !docNotes.trim()) return;
    setProcessingDocs(true);
    try {
      const contentBlocks = [];
      let plainTextNotes = docNotes.trim();
      let codeFilesText = "";
      for (const file of docFiles) {
        if (isCodeFile(file.name)) {
          try { const t = await readFileAsText(file); codeFilesText += `\n\n// --- ${file.name} ---\n${t}`; } catch {}
        } else if (file.type.startsWith("image/")) {
          const b64 = await readFileAsBase64(file);
          contentBlocks.push({ type: "image", source: { type: "base64", media_type: file.type, data: b64 } });
        } else if (file.type === "application/pdf") {
          const b64 = await readFileAsBase64(file);
          contentBlocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } });
        } else {
          try { const t = await readFileAsText(file); plainTextNotes += `\n\n[${file.name}]\n${t}`; } catch {}
        }
      }
      if (codeFilesText.trim() && onCodeExistant) {
        analyzeExistingCode(codeFilesText).then((result) => onCodeExistant(result)).catch(() => onCodeExistant("L'analyse du code a échoué — réessaie en rouvrant le projet, ou vérifie que le fichier n'est pas trop volumineux."));
      }
      const fullList = [...activeGoals, ...activeCustomGoals, ...extraGoals];
      const extracted = await extractFromDocuments(contentBlocks, plainTextNotes, fullList);
      let mergedAnswers = { ...answers };
      const covered = [];
      Object.entries(extracted || {}).forEach(([id, val]) => {
        const g = fullList.find((x) => x.id === id);
        if (g && val && String(val).trim()) { mergedAnswers[id] = { text: String(val).trim(), confidence: 80, state: "confirme", label: g.label }; covered.push(g.label); }
      });
      let currentExtraGoals = extraGoals;
      if (mergedAnswers.secteur?.text) {
        const detected = detectSectors(mergedAnswers.secteur.text);
        const newOnes = detected.map((key) => SECTOR_EXTRA_GOALS[key]).filter((g) => !currentExtraGoals.some((e) => e.id === g.id));
        if (newOnes.length) {
          currentExtraGoals = [...currentExtraGoals, ...newOnes];
          setExtraGoals(currentExtraGoals);
          // Second passage ciblé : le texte source peut déjà répondre aux
          // questions sectorielles qu'on vient de découvrir (ex. le client a
          // déjà précisé "pas de données médicales, pas d'HDS prévu" dans son
          // message). Sans ce second passage, le moteur repose la question
          // même quand la réponse est déjà là — bug réel constaté.
          const extraExtracted = await extractFromDocuments(contentBlocks, plainTextNotes, newOnes);
          Object.entries(extraExtracted || {}).forEach(([id, val]) => {
            const g = newOnes.find((x) => x.id === id);
            if (g && val && String(val).trim()) { mergedAnswers[id] = { text: String(val).trim(), confidence: 80, state: "confirme", label: g.label }; covered.push(g.label); }
          });
        }
      }
      setEntryMode("text");
      const codeNote = codeFilesText.trim() ? " J'analyse le code fourni en parallèle (Mode Reprise) — ce sera visible dans la fiche projet." : "";
      const intro = covered.length
        ? { role: "engine", text: `J'ai trouvé de quoi répondre à : ${covered.join(", ")}.${codeNote} Je continue sur ce qui reste.` }
        : { role: "engine", text: `Je n'ai rien trouvé d'exploitable pour le diagnostic dans ces documents.${codeNote} On continue par le dialogue.` };
      continueAfterAnswers(mergedAnswers, currentExtraGoals, [intro], null);
    } finally {
      setProcessingDocs(false);
    }
  }

  async function handleSubmit() {
    const text = input.trim();
    if (busy) return;
    if (!text && !awaitingOpenComment) return;
    setInput("");
    if (answerRef.current) answerRef.current.style.height = "auto";
    const withUser = text ? [...messages, { role: "user", text }] : messages;
    if (text) setMessages(withUser);

    if (awaitingOpenComment) {
      const finalAnswers = text ? { ...answers, commentaireLibre: { text, label: "Remarque libre" } } : answers;
      return finish(finalAnswers, withUser);
    }

    const goal = [...activeGoals, ...activeCustomGoals, ...extraGoals].find((g) => g.id === awaitingGoalId);
    const wordCountForGoal = text.split(/\s+/).filter(Boolean).length;
    // Contrôle élargi : toute réponse de moins de 20 mots passe par la
    // vérification IA (avant, seule une poignée de marqueurs de flou/une
    // longueur ≤2 mots déclenchait un contrôle — voir checkAnswer ci-dessus).
    if (!pendingRelance && wordCountForGoal < 20) {
      setBusy(true);
      const verdict = await checkAnswer(goal, text);
      setBusy(false);
      if (!verdict.ok) {
        setPendingRelance(true);
        setMessages([...withUser, { role: "engine", text: verdict.relance || `Tu peux préciser un peu plus, concrètement, sur "${goal.label.toLowerCase()}" ?` }]);
        return;
      }
    }
    const confidence = confidenceFor(text);
    const state = stateFor(confidence);
    let mergedAnswers = { ...answers, [goal.id]: { text, confidence, state, label: goal.label } };
    setPendingRelance(false);

    let currentExtraGoals = extraGoals;
    if (goal.id === "secteur") {
      const detected = detectSectors(text);
      const newOnes = detected.map((key) => SECTOR_EXTRA_GOALS[key]).filter((g) => !currentExtraGoals.some((e) => e.id === g.id));
      if (newOnes.length) { currentExtraGoals = [...currentExtraGoals, ...newOnes]; setExtraGoals(currentExtraGoals); }
    }

    const fullList = [...activeGoals, ...activeCustomGoals, ...currentExtraGoals];
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    let ackMessage = null;
    if (wordCount >= 20) {
      const remaining = fullList.filter((g) => !mergedAnswers[g.id]);
      if (remaining.length) {
        setBusy(true);
        const extracted = await extractMultipleAnswers(text, remaining);
        setBusy(false);
        const covered = [];
        Object.entries(extracted || {}).forEach(([id, val]) => {
          const g = remaining.find((r) => r.id === id);
          if (g && val && String(val).trim()) { mergedAnswers[id] = { text: String(val).trim(), confidence: 80, state: "confirme", label: g.label }; covered.push(g.label); }
        });
        if (covered.length) ackMessage = `Merci, ça répond aussi à : ${covered.join(", ")}. Je continue sur ce qui reste.`;
        // Correctif : la détection sectorielle (santé/juridique/enfance/finance/
        // service public) ne se déclenchait qu'ici que si "secteur" était la
        // question directement posée (voir bloc ci-dessus) — jamais si "secteur"
        // était rempli via cette extraction groupée. Un test réel a confirmé le
        // risque : un message initial riche peut couvrir "secteur" sans jamais
        // déclencher les questions complémentaires de sécurité.
        if (mergedAnswers.secteur?.text && !answers.secteur) {
          const detected = detectSectors(mergedAnswers.secteur.text);
          const newOnes = detected.map((key) => SECTOR_EXTRA_GOALS[key]).filter((g) => !currentExtraGoals.some((e) => e.id === g.id));
          if (newOnes.length) { currentExtraGoals = [...currentExtraGoals, ...newOnes]; setExtraGoals(currentExtraGoals); }
        }
      }
    }
    continueAfterAnswers(mergedAnswers, currentExtraGoals, withUser, ackMessage);
  }

  function tryTerminerMaintenant() {
    const fullList = [...activeGoals, ...activeCustomGoals, ...extraGoals];
    const missing = fullList.filter((g) => g.importance === 5 && !(answers[g.id] && answers[g.id].state === "confirme"));
    if (missing.length) { setEarlyFinishWarning(missing.map((g) => g.label)); return; }
    endOfGoals(answers, messages);
  }

  const answeredCount = Object.keys(answers).length;
  const confirmedCount = Object.values(answers).filter((a) => a.state === "confirme").length;

  if (entryMode === null) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 text-center">
        <h3 className="font-display text-xl mb-2">Comment tu veux procéder ?</h3>
        <p className="text-13 text-slate-500 mb-6 max-w-xs">Si tu as déjà des documents (notes, captures, devis...), je les lis directement — sinon on en discute simplement.</p>
        <div className="w-full max-w-xs space-y-2">
          <button onClick={startTextMode} className="w-full py-3 rounded-xl bg-amber-400 text-app text-sm font-medium">Répondre aux questions</button>
          <button onClick={() => setEntryMode("documents")} className="w-full py-3 rounded-xl bg-surface-2 border border-app text-sm text-slate-300">J'ai déjà des documents</button>
        </div>
      </div>
    );
  }

  if (entryMode === "documents" && messages.length === 0) {
    return (
      <div className="flex flex-col h-full px-5 py-6 max-w-2xl mx-auto w-full overflow-y-auto">
        <h3 className="font-display text-lg mb-2">Importer des documents</h3>
        <p className="text-12 text-slate-500 mb-4">Images, PDF, notes texte, ou fichiers de code d'un projet déjà en cours. Le code est analysé à part (Mode Reprise), pas mélangé aux réponses métier.</p>
        <label className="w-full py-2.5 rounded-xl border border-dashed border-app-strong text-slate-400 text-13 mb-3 flex items-center justify-center cursor-pointer">
          + Ajouter des fichiers
          <input type="file" multiple accept="image/*,application/pdf,text/plain,.md,.js,.jsx,.ts,.tsx,.py,.html,.css,.json,.java,.rb,.php,.go,.swift,.kt,.c,.cpp,.cs,.vue,.sql" className="hidden" onChange={(e) => { addDocFiles(e.target.files); e.target.value = ""; }} />
        </label>
        {docFiles.length > 0 && (
          <div className="space-y-1.5 mb-4">
            {docFiles.map((f, i) => (
              <div key={i} className="flex items-center justify-between bg-surface border border-app rounded-lg px-3 py-2">
                <span className="text-12 text-slate-300 truncate">{f.name}</span>
                <button onClick={() => removeDocFile(i)} className="text-slate-600 text-11 ml-2 shrink-0">Retirer</button>
              </div>
            ))}
          </div>
        )}
        <textarea value={docNotes} onChange={(e) => setDocNotes(e.target.value)} placeholder="Des notes en plus, en texte libre (facultatif)…" rows={3}
          className="w-full bg-surface-2 border border-app rounded-xl px-3.5 py-2.5 text-14 placeholder:text-slate-600 mb-4" />
        <button onClick={analyzeDocuments} disabled={processingDocs || (!docFiles.length && !docNotes.trim())}
          className="w-full py-3 rounded-xl bg-amber-400 text-app text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50">
          {processingDocs ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}{processingDocs ? "Analyse…" : "Analyser et continuer"}
        </button>
        <button onClick={startTextMode} className="w-full py-2.5 mt-2 text-13 text-slate-500">Passer, répondre à l'oral</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-app px-5 py-3 flex items-center gap-2 shrink-0">
        <div className="flex gap-2 overflow-x-auto flex-1">{knowledgeState().map((g) => { const s = STATE_STYLES[g.state]; return (<div key={g.id} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ring-1 ${s.ring} bg-surface shrink-0`}><span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} /><span className={`text-11 ${s.text} whitespace-nowrap`}>{g.label}</span></div>); })}</div>
        <button onClick={copyTranscript} title="Copier la conversation" className="p-1.5 rounded-lg hover:bg-surface text-slate-500 hover:text-amber-400 transition-colors shrink-0">
          {transcriptCopied ? <Check size={14} className="text-amber-400" /> : <Copy size={14} />}
        </button>
      </div>
      {transcriptFallback && (
        <div className="border-b border-app px-5 py-3 shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-11 text-red-300">Copie automatique indisponible — sélectionne le texte manuellement</p>
            <button onClick={() => setTranscriptFallback(null)} className="text-slate-500 text-11">Fermer</button>
          </div>
          <textarea readOnly value={transcriptFallback} onFocus={(e) => e.target.select()} className="w-full h-32 bg-surface-2 border border-app rounded-xl p-3 text-11 text-slate-300 font-mono-data" />
        </div>
      )}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-3 max-w-2xl mx-auto w-full">
        {messages.map((m, i) => (<div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-85 px-4 py-2.5 rounded-2xl text-14 leading-relaxed ${m.role === "user" ? "bg-amber-400/10 text-amber-100 border border-amber-400/20" : "bg-surface-2 text-cream border border-app"}`}>{m.text}</div></div>))}
        {synthesizing && <div className="flex items-center gap-2 text-slate-500 text-sm px-1 py-2"><Loader2 size={14} className="animate-spin" /> Construction de la synthèse…</div>}
      </div>
      {earlyFinishWarning && !synthesizing && (
        <div className="border-t border-app px-5 py-3 max-w-2xl mx-auto w-full shrink-0 bg-surface">
          <p className="text-12 text-amber-300 mb-2">Il manque encore des points importants : {earlyFinishWarning.join(", ")}.</p>
          <div className="flex gap-2">
            <button onClick={() => setEarlyFinishWarning(null)} className="flex-1 py-2 rounded-lg bg-surface-2 border border-app text-12 text-slate-300">Continuer à préciser</button>
            <button onClick={() => { setEarlyFinishWarning(null); endOfGoals(answers, messages); }} className="flex-1 py-2 rounded-lg bg-amber-400 text-app text-12 font-medium">Terminer quand même</button>
          </div>
        </div>
      )}
      {!synthesizing && !earlyFinishWarning && (
        <div className="border-t border-app px-5 py-4 max-w-2xl mx-auto w-full shrink-0">
          <div className="flex items-end gap-2">
            <textarea ref={answerRef} value={input} onChange={(e) => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px"; }} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }} placeholder={awaitingOpenComment ? "Facultatif…" : "Ta réponse…"} rows={1} disabled={busy} style={{ minHeight: "44px", maxHeight: "160px" }} className="flex-1 resize-none overflow-y-auto bg-surface-2 border border-app rounded-xl px-3.5 py-2.5 text-14 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-400/40 focus:border-amber-400/40 disabled:opacity-50" />
            <button onClick={handleSubmit} disabled={busy || (!input.trim() && !awaitingOpenComment)} className="p-2.5 rounded-xl bg-amber-400 text-app disabled:bg-surface-2 disabled:text-slate-600 transition-colors">{busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}</button>
          </div>
          <div className="flex items-center justify-between mt-2.5">
            <p className="text-11 text-slate-600 font-mono-data">{confirmedCount}/{activeGoals.length + activeCustomGoals.length} confirmé · {answeredCount} répondu</p>
            {awaitingOpenComment ? (
              <button onClick={() => finish(answers, messages)} className="text-11 text-slate-500 hover:text-amber-400 transition-colors underline underline-offset-2">Passer</button>
            ) : (
              answeredCount >= 3 && <button onClick={tryTerminerMaintenant} className="text-11 text-slate-500 hover:text-amber-400 transition-colors underline underline-offset-2">Terminer maintenant</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ClientDiscoveryShell({ theme }) {
  const [result, setResult] = useState(null);
  const [savedSubmission, setSavedSubmission] = useState(null);
  const [savingSubmission, setSavingSubmission] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [mailClicked, setMailClicked] = useState(false);
  const [copied, setCopied] = useState(false);
  const [settings, setSettings] = useState({ studioName: PLACEHOLDER_STUDIO, feedbackEmail: PLACEHOLDER_EMAIL });
  const [customGoals, setCustomGoals] = useState([]);
  const [questionOverrides, setQuestionOverrides] = useState([]);
  const [token] = useState(() => { try { return new URLSearchParams(window.location.search).get("token") || null; } catch { return null; } });
  const [tokenState, setTokenState] = useState(token ? "checking" : "no-token"); // checking | valid | used | no-token
  const themeClass = theme === "light" ? "theme-light" : "theme-dark";

  useEffect(() => { (async () => {
    try { const r = await window.storage.get("nandem-public-settings", true); if (r) setSettings(JSON.parse(r.value)); } catch {}
    try { const r = await window.storage.get("nandem-custom-goals"); if (r) setCustomGoals(JSON.parse(r.value)); } catch {}
    try { const r = await window.storage.get("nandem-question-overrides"); if (r) setQuestionOverrides(JSON.parse(r.value)); } catch {}
  })(); }, []);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const storedToken = await window.storage.get(`used-token:${token}`, true);
        setTokenState(storedToken?.value === token ? "used" : "valid");
      } catch { setTokenState("valid"); }
    })();
  }, [token]);

  async function markTokenUsed() {
    if (!token) return;
    try { await window.storage.set(`used-token:${token}`, token, true); } catch {}
  }

  function handleComplete(answers, synthesis, error) { setResult({ answers, synthesis, error }); }

  async function saveClientSubmission() {
    if (!result || savingSubmission || savedSubmission) return;
    setSavingSubmission(true);
    setSaveError(null);
    try {
      const stored = await window.storage.get("nandem-client-submissions", true);
      const existing = stored ? JSON.parse(stored.value) : [];
      const id = token ? `client:${token}` : `client:${genId()}`;
      const submission = {
        id, token, categorie: chosenCategorie || "Entreprise",
        answers: result.answers || {}, synthesis: result.synthesis || null,
        error: result.error || null, savedAt: new Date().toISOString(), status: "Nouveau",
      };
      const next = [submission, ...existing.filter((item) => item.id !== id)].slice(0, 200);
      await window.storage.set("nandem-client-submissions", JSON.stringify(next), true);
      await markTokenUsed();
      setSavedSubmission(submission);
    } catch (e) {
      setSaveError(`La sauvegarde n'a pas abouti (${e?.message || "erreur inconnue"}). Le lien reste utilisable.`);
    } finally {
      setSavingSubmission(false);
    }
  }

  const mailtoHref = result
    ? (() => {
        const activite = result.answers?.activite?.text?.slice(0, 60) || "Nouveau diagnostic";
        const subject = encodeURIComponent(`Diagnostic Discovery — ${activite}`);
        const body = encodeURIComponent(buildClientEmailBody(result.answers, result.synthesis));
        return `mailto:${settings.feedbackEmail}?subject=${subject}&body=${body}`;
      })()
    : "#";

  async function copyDiagnostic() {
    if (!result) return;
    const text = buildClientEmailBody(result.answers, result.synthesis);
    try {
      if (!navigator.clipboard) throw new Error("indisponible");
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Rien à faire de plus ici : le texte est déjà affiché en permanence
      // dans le textarea ci-dessous, sélectionnable manuellement.
    }
  }
  const [introSeen, setIntroSeen] = useState(false);
  const [chosenCategorie, setChosenCategorie] = useState(null);

  if (tokenState === "checking") {
    return (<div className={`min-h-screen bg-app flex items-center justify-center ${themeClass}`}><GlobalStyle /><Loader2 className="animate-spin text-amber-400" /></div>);
  }
  if (tokenState === "used") {
    return (
      <div className={`min-h-screen w-full bg-app text-cream font-sans flex items-center justify-center px-6 ${themeClass}`}>
        <GlobalStyle />
        <div className="max-w-sm text-center">
          <div className="w-12 h-12 rounded-full bg-surface border border-app flex items-center justify-center mx-auto mb-4"><Link2 size={20} className="text-slate-500" /></div>
          <h2 className="font-display text-xl mb-2">Ce lien a déjà été utilisé</h2>
          <p className="text-sm text-slate-400 leading-relaxed">Ton diagnostic a bien été transmis. Si tu as besoin de le refaire, demande un nouveau lien à {settings.studioName}.</p>
        </div>
      </div>
    );
  }
  if (!introSeen && !result) {
    return (
      <div className={`min-h-screen w-full max-w-full overflow-x-hidden bg-app text-cream font-sans flex flex-col items-center justify-center px-6 text-center ${themeClass}`}>
        <GlobalStyle />
        <div className="w-12 h-12 rounded-full bg-amber-400/10 border border-amber-400/30 flex items-center justify-center mb-5"><Sparkles size={20} className="text-amber-400" /></div>
        <h1 className="font-display text-xl mb-3">Diagnostic de projet — {settings.studioName}</h1>
        {settings.bio?.trim() && <p className="text-13 text-amber-300/80 leading-relaxed max-w-xs mb-3">{settings.bio}</p>}
        <p className="text-sm text-slate-400 leading-relaxed max-w-xs mb-3">On va discuter quelques minutes de ton projet. Réponds comme tu le sentirais à un designer — tout ce que tu as déjà en tête compte, même en vrac. Rien n'est partagé avant que tu ne cliques toi-même sur "Envoyer" à la fin.</p>
        {settings.tarifIndicatif?.trim() && <p className="text-11 text-slate-500 mb-6">Tarif indicatif : {settings.tarifIndicatif}</p>}
        <button onClick={() => setIntroSeen(true)} className="w-full max-w-xs py-3 rounded-xl bg-amber-400 text-app text-sm font-medium mt-3">Commencer</button>
      </div>
    );
  }
  if (introSeen && !chosenCategorie && !result) {
    return (
      <div className={`min-h-screen w-full max-w-full overflow-x-hidden bg-app text-cream font-sans flex flex-col items-center justify-center px-6 text-center ${themeClass}`}>
        <GlobalStyle />
        <h2 className="font-display text-lg mb-2">C'est quel genre de projet ?</h2>
        <p className="text-13 text-slate-500 mb-6 max-w-xs">Les questions ne sont pas les mêmes selon le cas — ça évite de te poser des questions hors sujet.</p>
        <div className="w-full max-w-xs space-y-2">
          <button onClick={() => setChosenCategorie("Entreprise")} className="w-full py-3 rounded-xl bg-amber-400 text-app text-sm font-medium">Une société / un outil de gestion</button>
          <button onClick={() => setChosenCategorie("App")} className="w-full py-3 rounded-xl bg-surface-2 border border-app text-sm text-slate-300">Une application (public, grand public)</button>
        </div>
      </div>
    );
  }
  return (
    <div className={`min-h-screen w-full max-w-full overflow-x-hidden bg-app text-cream font-sans ${themeClass}`}>
      <GlobalStyle />
      <header className="border-b border-app px-5 py-4 flex items-center gap-2">
        <Sparkles size={18} className="text-amber-400" strokeWidth={1.75} />
        <h1 className="font-display text-lg tracking-tight">Diagnostic de projet — {settings.studioName}</h1>
      </header>
      {!result && (<div className="h-header-offset"><DiscoveryFlow onComplete={handleComplete} categorie={chosenCategorie} customGoals={customGoals} questionOverrides={questionOverrides} /></div>)}
      {result && (
        <div className="max-w-md mx-auto px-5 py-10 text-center">
          <div className="w-12 h-12 rounded-full bg-amber-400/10 border border-amber-400/30 flex items-center justify-center mx-auto mb-4"><Mail size={20} className="text-amber-400" /></div>
          <h2 className="font-display text-xl mb-2">Merci</h2>
          <p className="text-sm text-slate-400 mb-6 leading-relaxed">Ton diagnostic est prêt. Enregistre-le dans NANDĒM pour que l'équipe puisse le retrouver sans ressaisie.</p>
          {result.error && <p className="text-12 text-red-300 mb-4">{result.error}</p>}

          <button onClick={saveClientSubmission} disabled={savingSubmission || !!savedSubmission} className={`w-full py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 ${savedSubmission ? "bg-emerald-500/15 border border-emerald-400/30 text-emerald-300" : "bg-amber-400 text-app disabled:opacity-60"}`}>
            {savingSubmission ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            {savingSubmission ? "Enregistrement…" : savedSubmission ? "Enregistré dans NANDĒM" : "Enregistrer et transmettre à NANDĒM"}
          </button>
          {saveError && <p className="text-11 text-red-300 mt-2">{saveError}</p>}
          {savedSubmission && <p className="text-11 text-emerald-300/80 mt-2">C'est sauvegardé. Tu peux fermer cette page.</p>}

          <button onClick={copyDiagnostic} className="w-full mt-5 py-3 rounded-xl bg-surface-2 border border-app text-slate-300 text-sm font-medium flex items-center justify-center gap-2">
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? "Copié — colle-le où tu veux l'envoyer" : "Copier le résumé complet"}
          </button>
          <p className="text-11 text-slate-500 mt-2">Colle-le ensuite dans un message, un mail, ou autre — à toi de choisir comment le transmettre.</p>

          <div className="mt-4 text-left">
            <textarea readOnly value={buildClientEmailBody(result.answers, result.synthesis)} onFocus={(e) => e.target.select()} rows={8} className="w-full bg-surface-2 border border-app rounded-xl p-3 text-11 text-slate-300 font-mono-data" />
          </div>

          <div className="mt-5 pt-5 border-t border-app">
            <a href={mailtoHref} onClick={() => setMailClicked(true)} className="w-full py-2.5 rounded-xl bg-surface-2 border border-app text-13 text-slate-300 flex items-center justify-center gap-2">
              <Mail size={14} /> Essayer d'envoyer par mail
            </a>
            <p className="text-10 text-slate-600 mt-2">Ne fonctionne pas toujours depuis l'application Claude — le copier-coller ci-dessus reste la solution la plus fiable ici.</p>
            {mailClicked && (
              <p className="text-11 text-amber-300/80 mt-2">Ton application mail a peut-être essayé de s'ouvrir — vérifie, sinon utilise le copier-coller.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MODE ADMIN
// ---------------------------------------------------------------------------

function EntrepriseSection({ project, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [nom, setNom] = useState(project.entreprise?.nom || "");
  const [secteur, setSecteur] = useState(project.entreprise?.secteur || "");
  const [taille, setTaille] = useState(project.entreprise?.taille || "");
  function save() { onUpdate({ nom, secteur, taille }); setEditing(false); }
  const has = project.entreprise?.nom;
  return (
    <div className="mb-5 p-4 rounded-xl bg-surface border border-app">
      <div className="flex items-center justify-between mb-2"><p className="text-11 uppercase tracking-wider text-slate-500 flex items-center gap-1.5"><Building2 size={12} /> Entreprise</p>{!editing && <button onClick={() => setEditing(true)} className="text-11 text-amber-400/70 hover:text-amber-300">{has ? "Modifier" : "Ajouter"}</button>}</div>
      {!editing && (has ? (<p className="text-13 text-slate-300">{project.entreprise.nom} — {project.entreprise.secteur || "secteur non précisé"} · {project.entreprise.taille || "taille non précisée"}</p>) : (<p className="text-12 text-slate-600">Non renseignée (optionnel).</p>))}
      {editing && (<div className="space-y-2 mt-2"><input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom de l'entreprise" className="w-full bg-surface-2 border border-app rounded-lg px-3 py-1.5 text-13 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-400/40" /><input value={secteur} onChange={(e) => setSecteur(e.target.value)} placeholder="Secteur" className="w-full bg-surface-2 border border-app rounded-lg px-3 py-1.5 text-13 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-400/40" /><input value={taille} onChange={(e) => setTaille(e.target.value)} placeholder="Taille (ex : 1 personne, 5 employés)" className="w-full bg-surface-2 border border-app rounded-lg px-3 py-1.5 text-13 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-400/40" /><div className="flex gap-2 justify-end"><button onClick={() => setEditing(false)} className="text-12 text-slate-500 px-2 py-1">Annuler</button><button onClick={save} className="text-12 bg-amber-400 text-app px-3 py-1 rounded-lg">Enregistrer</button></div></div>)}
    </div>
  );
}
// Mini-CRM — coordonnées réelles du client. Distinct d'"Entreprise" (qui
// décrit l'activité/secteur) : ici c'est la personne à qui parler.
function ClientSection({ project, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [nom, setNom] = useState(project.client?.nom || "");
  const [email, setEmail] = useState(project.client?.email || "");
  const [telephone, setTelephone] = useState(project.client?.telephone || "");
  function save() { onUpdate({ nom, email, telephone }); setEditing(false); }
  const has = project.client?.nom || project.client?.email;
  return (
    <div className="mb-5 p-4 rounded-xl bg-surface border border-app">
      <div className="flex items-center justify-between mb-2"><p className="text-11 uppercase tracking-wider text-slate-500 flex items-center gap-1.5"><MessageSquare size={12} /> Contact client</p>{!editing && <button onClick={() => setEditing(true)} className="text-11 text-amber-400/70 hover:text-amber-300">{has ? "Modifier" : "Ajouter"}</button>}</div>
      {!editing && (has ? (<p className="text-13 text-slate-300">{project.client.nom || "Nom non précisé"}{project.client.email ? ` — ${project.client.email}` : ""}{project.client.telephone ? ` · ${project.client.telephone}` : ""}</p>) : (<p className="text-12 text-slate-600">Non renseigné — utile pour savoir qui relancer.</p>))}
      {editing && (<div className="space-y-2 mt-2"><input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom du contact" className="w-full bg-surface-2 border border-app rounded-lg px-3 py-1.5 text-13 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-400/40" /><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full bg-surface-2 border border-app rounded-lg px-3 py-1.5 text-13 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-400/40" /><input value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="Téléphone" className="w-full bg-surface-2 border border-app rounded-lg px-3 py-1.5 text-13 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-400/40" /><div className="flex gap-2 justify-end"><button onClick={() => setEditing(false)} className="text-12 text-slate-500 px-2 py-1">Annuler</button><button onClick={save} className="text-12 bg-amber-400 text-app px-3 py-1 rounded-lg">Enregistrer</button></div></div>)}
    </div>
  );
}
// Étape commerciale — distincte du statut technique du projet. Simple
// sélecteur, cohérent avec les autres choix à boutons de l'app.
const PIPELINE_STAGES = ["Prospect", "Devis envoyé", "Signé", "En cours", "Livré", "Facturé", "Perdu"];
function PipelineSection({ project, onUpdate }) {
  const stage = project.pipeline || "Prospect";
  return (
    <div className="mb-5 p-4 rounded-xl bg-surface border border-app">
      <p className="text-11 uppercase tracking-wider text-slate-500 mb-2">Étape commerciale</p>
      <div className="flex flex-wrap gap-1.5">
        {PIPELINE_STAGES.map((s) => (
          <button key={s} onClick={() => onUpdate(s)} className={`text-12 px-2.5 py-1 rounded-full border transition-colors ${stage === s ? "bg-amber-400 text-app border-amber-400" : "border-app text-slate-400"}`}>{s}</button>
        ))}
      </div>
    </div>
  );
}
// Suivi financier — devis annoncé, montant réellement encaissé, temps passé
// (27/08/2026) et facture. Trois documents distincts, à la demande explicite
// du porteur : « le devis c'est ce que j'envoie au client, la facture c'est
// quand le client a payé ». onUpdateProject est le patch générique déjà
// utilisé partout ailleurs (onUpdateProject({ champ: valeur })) — FinanceSection
// l'appelle directement pour finance/tempsPasse/facture au lieu de passer par
// un setter dédié à chaque champ, pour rester réutilisable aux 4 endroits où
// ce composant est monté (Aperçu × 2, Facturation).
function FinanceSection({ project, onUpdateProject, studioName, feedbackEmail, tarifHoraire }) {
  const [editing, setEditing] = useState(false);
  const [devis, setDevis] = useState(project.finance?.devis ?? "");
  const [paye, setPaye] = useState(project.finance?.paye ?? "");
  const [note, setNote] = useState(project.finance?.note || "");
  function save() { onUpdateProject({ finance: { devis: devis === "" ? null : Number(devis), paye: paye === "" ? null : Number(paye), note } }); setEditing(false); }
  const has = project.finance?.devis != null || project.finance?.paye != null;
  const devisVal = project.finance?.devis;
  const payeVal = project.finance?.paye;
  const reste = devisVal != null && payeVal != null ? devisVal - payeVal : null;

  // Temps passé — saisie manuelle par ligne (date, heures, note courte),
  // choix fait pour rester simple : pas de chrono à penser à démarrer/arrêter.
  const temps = project.tempsPasse || [];
  const totalHeures = temps.reduce((sum, e) => sum + (Number(e.heures) || 0), 0);
  const coutReel = tarifHoraire ? Math.round(totalHeures * tarifHoraire * 100) / 100 : null;
  const [newDate, setNewDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newHeures, setNewHeures] = useState("");
  const [newNote, setNewNote] = useState("");
  function addTemps() {
    const h = Number(newHeures);
    if (!h || h <= 0) return;
    const entry = { id: genId(), date: newDate, heures: h, note: newNote.trim() };
    onUpdateProject({ tempsPasse: [entry, ...temps] });
    setNewHeures(""); setNewNote("");
  }
  function removeTemps(id) { onUpdateProject({ tempsPasse: temps.filter((e) => e.id !== id) }); }

  // Facture — n'apparaît en pleine section qu'une fois un paiement enregistré
  // (ou si une facture existe déjà) : cohérent avec « la facture c'est quand
  // le client a payé », pas un document qu'on prépare à l'avance comme le devis.
  const factureExisting = project.facture || null;
  const [factureNumero, setFactureNumero] = useState(factureExisting?.numero || "");
  const [factureDate, setFactureDate] = useState(factureExisting?.date || new Date().toISOString().slice(0, 10));
  const [factureMontant, setFactureMontant] = useState(factureExisting?.montant ?? payeVal ?? "");
  const [factureNote, setFactureNote] = useState(factureExisting?.note || "");
  const [factureCopied, setFactureCopied] = useState(false);
  function genererFacture() {
    const fields = { numero: factureNumero.trim(), date: factureDate, montant: factureMontant === "" ? null : Number(factureMontant), note: factureNote.trim() };
    const content = buildFactureTemplate(project, fields, temps, studioName, feedbackEmail);
    onUpdateProject({ facture: { ...fields, content, updatedAt: new Date().toISOString() } });
  }
  async function copyFacture() {
    if (!project.facture?.content) return;
    try { if (!navigator.clipboard) throw new Error("indisponible"); await navigator.clipboard.writeText(project.facture.content); setFactureCopied(true); setTimeout(() => setFactureCopied(false), 1800); } catch {}
  }
  const showFactureBlock = payeVal != null || factureExisting;

  return (
    <div className="mb-5 p-4 rounded-xl bg-surface border border-app">
      <div className="flex items-center justify-between mb-2"><p className="text-11 uppercase tracking-wider text-slate-500">Finances</p>{!editing && <button onClick={() => setEditing(true)} className="text-11 text-amber-400/70 hover:text-amber-300">{has ? "Modifier" : "Ajouter"}</button>}</div>
      {!editing && (has ? (
        <div>
          <p className="text-13 text-slate-300">Devis : {devisVal != null ? `${devisVal} €` : "non chiffré"} · Encaissé : {payeVal != null ? `${payeVal} €` : "0 €"}{reste != null && <span className={reste > 0 ? "text-amber-300" : "text-emerald-400"}> · {reste > 0 ? `Reste ${reste} €` : "Soldé"}</span>}</p>
          {project.finance?.note && <p className="text-11 text-slate-500 mt-1">{project.finance.note}</p>}
        </div>
      ) : (<p className="text-12 text-slate-600">Non renseigné.</p>))}
      {editing && (<div className="space-y-2 mt-2">
        <input type="number" value={devis} onChange={(e) => setDevis(e.target.value)} placeholder="Montant du devis (€)" className="w-full bg-surface-2 border border-app rounded-lg px-3 py-1.5 text-13 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-400/40" />
        <input type="number" value={paye} onChange={(e) => setPaye(e.target.value)} placeholder="Montant encaissé (€)" className="w-full bg-surface-2 border border-app rounded-lg px-3 py-1.5 text-13 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-400/40" />
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (ex : acompte 30%...)" className="w-full bg-surface-2 border border-app rounded-lg px-3 py-1.5 text-13 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-400/40" />
        <div className="flex gap-2 justify-end"><button onClick={() => setEditing(false)} className="text-12 text-slate-500 px-2 py-1">Annuler</button><button onClick={save} className="text-12 bg-amber-400 text-app px-3 py-1 rounded-lg">Enregistrer</button></div>
      </div>)}

      <div className="mt-4 pt-4 border-t border-app-soft">
        <p className="text-11 uppercase tracking-wider text-slate-500 mb-2">Temps passé</p>
        <div className="flex gap-1.5 mb-2">
          <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="bg-surface-2 border border-app rounded-lg px-2 py-1.5 text-12 text-slate-300 focus:outline-none focus:ring-1 focus:ring-amber-400/40" />
          <input type="number" step="0.25" value={newHeures} onChange={(e) => setNewHeures(e.target.value)} placeholder="h" className="w-16 bg-surface-2 border border-app rounded-lg px-2 py-1.5 text-12 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-400/40" />
          <input value={newNote} onChange={(e) => setNewNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTemps()} placeholder="Note (ex : intégration paiement)" className="flex-1 bg-surface-2 border border-app rounded-lg px-2 py-1.5 text-12 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-400/40" />
          <button onClick={addTemps} disabled={!newHeures} className="px-3 rounded-lg bg-amber-400 text-app text-12 shrink-0 disabled:opacity-40">Ajouter</button>
        </div>
        {temps.length > 0 ? (
          <>
            <div className="space-y-1 mb-2 max-h-40 overflow-y-auto">
              {temps.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-2 text-12 text-slate-400 py-0.5">
                  <span className="truncate">{new Date(e.date).toLocaleDateString("fr-FR")} · {e.heures} h{e.note ? ` · ${e.note}` : ""}</span>
                  <button onClick={() => removeTemps(e.id)} className="text-slate-600 hover:text-red-400 shrink-0">×</button>
                </div>
              ))}
            </div>
            <p className="text-12 text-slate-300">Total : {totalHeures} h{coutReel != null && ` · ~${coutReel} € au taux horaire réglé`}</p>
            {devisVal != null && coutReel != null && <p className="text-11 text-slate-500 mt-0.5">Devis {devisVal} € vs coût réel estimé {coutReel} € → {devisVal - coutReel >= 0 ? `marge ~${(devisVal - coutReel).toFixed(2)} €` : `dépassement ~${(coutReel - devisVal).toFixed(2)} €`}</p>}
          </>
        ) : (<p className="text-11 text-slate-600">Aucune ligne saisie.</p>)}
      </div>

      {showFactureBlock && (
        <div className="mt-4 pt-4 border-t border-app-soft">
          <p className="text-11 uppercase tracking-wider text-slate-500 mb-2">Facture — une fois le client payé</p>
          <div className="grid grid-cols-2 gap-1.5 mb-1.5">
            <input value={factureNumero} onChange={(e) => setFactureNumero(e.target.value)} placeholder="N° (ex : 2026-014)" className="bg-surface-2 border border-app rounded-lg px-2 py-1.5 text-12 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-400/40" />
            <input type="date" value={factureDate} onChange={(e) => setFactureDate(e.target.value)} className="bg-surface-2 border border-app rounded-lg px-2 py-1.5 text-12 text-slate-300 focus:outline-none focus:ring-1 focus:ring-amber-400/40" />
          </div>
          <input type="number" value={factureMontant} onChange={(e) => setFactureMontant(e.target.value)} placeholder="Montant réglé (€)" className="w-full bg-surface-2 border border-app rounded-lg px-2 py-1.5 text-12 mb-1.5 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-400/40" />
          <input value={factureNote} onChange={(e) => setFactureNote(e.target.value)} placeholder="Note (facultatif)" className="w-full bg-surface-2 border border-app rounded-lg px-2 py-1.5 text-12 mb-2 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-400/40" />
          <button onClick={genererFacture} className="w-full py-2 rounded-lg bg-surface-2 border border-app text-12 text-slate-300 flex items-center justify-center gap-2"><Receipt size={13} />{factureExisting ? "Mettre à jour la facture" : "Générer la facture"}</button>
          {project.facture?.content && (<>
            <div className="p-3 mt-2 rounded-lg bg-surface-2 border border-app-soft text-11 text-slate-300 whitespace-pre-line leading-relaxed max-h-48 overflow-y-auto">{project.facture.content}</div>
            <button onClick={copyFacture} className="w-full mt-2 py-2 rounded-lg bg-amber-400 text-app text-12 flex items-center justify-center gap-2">{factureCopied ? <Check size={13} /> : <Copy size={13} />}{factureCopied ? "Copié" : "Copier la facture"}</button>
          </>)}
        </div>
      )}
    </div>
  );
}
function DocumentsSection({ project, onUpdate }) {
  const [noteText, setNoteText] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try { const dataUrl = await compressImage(file); onUpdate([...(project.documents || []), { id: genId(), type: "photo", data: dataUrl, label: file.name, date: new Date().toISOString() }]); }
    catch {} finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  }
  function addNote() { if (!noteText.trim()) return; onUpdate([...(project.documents || []), { id: genId(), type: "note", text: noteText.trim(), label: noteText.trim().slice(0, 30), date: new Date().toISOString() }]); setNoteText(""); }
  function remove(id) { onUpdate((project.documents || []).filter((d) => d.id !== id)); }
  const docs = project.documents || [];
  return (
    <div className="border-t border-app pt-5 mt-6">
      <h3 className="font-display text-base mb-3 flex items-center gap-1.5"><FileText size={15} /> Documents</h3>
      <p className="text-11 text-slate-600 mb-3">Photos compressées + notes texte. ⚠️ Stockage limité — évite d'accumuler trop de photos sur un même projet.</p>
      <div className="flex gap-2 mb-3">
        <input value={noteText} onChange={(e) => setNoteText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addNote()} placeholder="Ajouter une note…" className="flex-1 bg-surface-2 border border-app rounded-lg px-3 py-2 text-13 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-400/40" />
        <button onClick={addNote} className="px-3 rounded-lg bg-surface-2 border border-app text-slate-300"><Plus size={14} /></button>
        <label className="px-3 rounded-lg bg-surface-2 border border-app text-slate-300 flex items-center cursor-pointer">{uploading ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}<input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" /></label>
      </div>
      {docs.length === 0 ? <p className="text-12 text-slate-600">Aucun document.</p> : (<div className="space-y-2">{docs.map((d) => (<div key={d.id} className="p-2.5 rounded-lg bg-surface border border-app flex items-center gap-2.5 group">{d.type === "photo" ? <img src={d.data} alt={d.label} className="w-10 h-10 rounded object-cover shrink-0" /> : <div className="w-10 h-10 rounded bg-surface flex items-center justify-center shrink-0"><FileText size={14} className="text-slate-500" /></div>}<div className="flex-1 min-w-0"><p className="text-12 text-slate-300 truncate">{d.type === "note" ? d.text : d.label}</p><p className="text-10 text-slate-600 font-mono-data">{new Date(d.date).toLocaleDateString("fr-FR")}</p></div><button onClick={() => remove(d.id)} className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all shrink-0"><Trash2 size={13} /></button></div>))}</div>)}
    </div>
  );
}
function ConversationSection({ project }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState(null);
  if (!project.conversation?.length) return <div className="p-5 rounded-xl bg-surface border border-app"><h2 className="font-display text-lg mb-2">Conversation</h2><p className="text-13 text-slate-500">Aucun échange enregistré pour ce projet. La conversation du diagnostic apparaîtra ici dès qu’elle aura commencé.</p></div>;
  async function copyIt() {
    const text = formatTranscript(project.conversation);
    try { if (!navigator.clipboard) throw new Error("indisponible"); await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { setFallback(text); }
  }
  function downloadIt() {
    try {
      const text = formatTranscript(project.conversation);
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `conversation-${(project.nom || "projet").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.txt`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {}
  }
  return (
    <div className="border-t border-app pt-5 mt-6">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setOpen(!open)} className="flex items-center gap-1.5 text-11 uppercase tracking-wider text-slate-500"><MessageSquare size={12} /> Conversation brute <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} /></button>
        <div className="flex items-center gap-1">
          <button onClick={copyIt} title="Copier" className="p-1.5 rounded-lg hover:bg-surface text-slate-500 hover:text-amber-400 transition-colors">{copied ? <Check size={13} className="text-amber-400" /> : <Copy size={13} />}</button>
          <button onClick={downloadIt} title="Télécharger (.txt)" className="p-1.5 rounded-lg hover:bg-surface text-slate-500 hover:text-amber-400 transition-colors"><Download size={13} /></button>
        </div>
      </div>
      {fallback && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1.5"><p className="text-11 text-red-300">Copie automatique indisponible — sélectionne le texte manuellement</p><button onClick={() => setFallback(null)} className="text-slate-500 text-11">Fermer</button></div>
          <textarea readOnly value={fallback} onFocus={(e) => e.target.select()} className="w-full h-32 bg-surface-2 border border-app rounded-xl p-3 text-11 text-slate-300 font-mono-data" />
        </div>
      )}
      {open && (<div className="space-y-2 max-h-64 overflow-y-auto">{project.conversation.map((m, i) => (<div key={i} className={`text-12 px-3 py-1.5 rounded-lg ${m.role === "user" ? "bg-amber-400/5 text-amber-200" : "bg-surface text-slate-400"}`}>{m.text}</div>))}</div>)}
    </div>
  );
}

const REALIZATION_REVIEW_FIELDS = [
  ["needSolved", "Besoin principal résolu"], ["useful", "Fonctionnalités réellement utiles"], ["understandable", "Application compréhensible"],
  ["distinctive", "Identité adaptée, non générique"], ["reliable", "Comportement fiable"], ["regressionFree", "Aucune régression observée"],
];
const REALIZATION_REVIEW_VALUES = ["Non vérifié", "Oui", "Partiellement", "Non"];
const REQUIREMENT_RESULT_VALUES = ["Non vérifiable", "Respectée", "Partiellement respectée", "Non respectée", "Non pertinente"];

function RealizationCycle({ project, engineRequirements, promptAddendum, onUpdateProject, onAddLearning }) {
  const realizations = project.realizations || [];
  const [activeId, setActiveId] = useState(realizations[0]?.id || null);
  const [providerDraft, setProviderDraft] = useState("");
  const [objectiveDraft, setObjectiveDraft] = useState("");
  const [verifying, setVerifying] = useState(null);
  const [verifyError, setVerifyError] = useState(null);
  // Vérification manuelle (27/08/2026) — même besoin que le "Mode Assistant
  // bêta" du diagnostic : pouvoir copier la demande de vérification et coller
  // la réponse d'un autre outil/IA, sans dépendre de l'appel askClaude()
  // intégré (pas de crédit API, ou IA différente déjà utilisée pour construire).
  const [manualVerifyOpen, setManualVerifyOpen] = useState(false);
  const [manualVerifyText, setManualVerifyText] = useState("");
  const [manualVerifyError, setManualVerifyError] = useState(null);
  const [manualVerifyCopied, setManualVerifyCopied] = useState(false);
  const [reportPromptCopied, setReportPromptCopied] = useState(false);
  const [debriefing, setDebriefing] = useState(false);
  const [debriefError, setDebriefError] = useState(null);
  const [debriefCopied, setDebriefCopied] = useState(false);
  const active = realizations.find((item) => item.id === activeId) || realizations[0] || null;
  function saveAll(next) { onUpdateProject({ realizations: next }); }
  function updateActive(patch) {
    if (!active) return;
    saveAll(realizations.map((item) => item.id === active.id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item));
  }
  function createRealization() {
    const selection = selectRequirementsForProject(project, engineRequirements);
    const realization = {
      id: `realization:${genId()}`, version: 1, createdAt: new Date().toISOString(), status: "Dossier préparé",
      provider: providerDraft.trim() || "Outil non précisé", objective: objectiveDraft.trim() || "Construire la version bêta validable",
      promptSnapshot: buildUniversalBuildPrompt(project, promptAddendum, engineRequirements),
      buildPackageSnapshot: buildPortableBuildPackage(project, promptAddendum, engineRequirements),
      requirementsSnapshot: selection.selected.map(({ requirement, reason }) => ({ id: requirement.id, label: requirement.label, instruction: requirement.instruction, tests: requirement.tests || [], reason })),
      initialResult: "", correctedResult: "", humanReview: Object.fromEntries(REALIZATION_REVIEW_FIELDS.map(([id]) => [id, "Non vérifié"])),
      requirementReview: {}, initialVerification: null, finalVerification: null, freeFeedback: "", learningProposal: "", learningPromoted: false,
      builderDebriefPrompt: "", builderDebriefResponse: "", builderDebriefSynthesis: null,
    };
    saveAll([realization, ...realizations]); setActiveId(realization.id); setProviderDraft(""); setObjectiveDraft("");
  }
  async function verify(kind) {
    if (!active) return;
    const resultText = kind === "initial" ? active.initialResult : active.correctedResult;
    if (!resultText?.trim()) return;
    setVerifying(kind); setVerifyError(null);
    try {
      const report = await verifyGeneratedResult(active.promptSnapshot, resultText);
      updateActive({ [kind === "initial" ? "initialVerification" : "finalVerification"]: { ...report, verifiedAt: new Date().toISOString() }, status: kind === "initial" ? "Écarts analysés" : "Résultat final vérifié" });
    } catch (error) { setVerifyError(error.message); }
    setVerifying(null);
  }
  async function copyReportPrompt() {
    try { await navigator.clipboard.writeText(buildReportRequestPrompt()); setReportPromptCopied(true); setTimeout(() => setReportPromptCopied(false), 1800); } catch {}
  }
  async function copyManualVerifyPrompt() {
    if (!active?.initialResult?.trim()) return;
    const prompt = buildVerificationPrompt(active.promptSnapshot, active.initialResult);
    try { await navigator.clipboard.writeText(prompt); setManualVerifyCopied(true); setTimeout(() => setManualVerifyCopied(false), 1800); }
    catch { setManualVerifyError("Copie automatique indisponible : sélectionne la demande affichée."); }
  }
  function importManualVerification() {
    try {
      const report = parseVerificationResponse(extractJSON(manualVerifyText));
      updateActive({ initialVerification: { ...report, verifiedAt: new Date().toISOString(), source: "manuel" }, status: "Écarts analysés" });
      setManualVerifyText(""); setManualVerifyError(null); setManualVerifyOpen(false);
    } catch (error) { setManualVerifyError(`Réponse non importée : ${error.message}`); }
  }
  async function copyDebriefPrompt() {
    if (!active) return;
    const frozenPrompt = active.builderDebriefPrompt || buildBuilderDebriefPrompt(active);
    if (!active.builderDebriefPrompt) updateActive({ builderDebriefPrompt: frozenPrompt });
    try { await navigator.clipboard.writeText(frozenPrompt); setDebriefCopied(true); setTimeout(() => setDebriefCopied(false), 1800); }
    catch { setDebriefError("Copie automatique indisponible : sélectionne le questionnaire affiché."); }
  }
  async function analyzeDebrief() {
    if (!active?.builderDebriefResponse?.trim()) return;
    setDebriefing(true); setDebriefError(null);
    try {
      const frozenPrompt = active.builderDebriefPrompt || buildBuilderDebriefPrompt(active);
      const synthesis = await synthesizeBuilderDebrief({ ...active, builderDebriefPrompt: frozenPrompt }, active.builderDebriefResponse);
      updateActive({ builderDebriefPrompt: frozenPrompt, builderDebriefSynthesis: synthesis, learningProposal: synthesis.learningProposal, status: "Débrief formalisé" });
    } catch (error) { setDebriefError(error.message); }
    setDebriefing(false);
  }
  const initialScore = active?.initialVerification?.score;
  const finalScore = active?.finalVerification?.score;
  const scoreDelta = Number.isFinite(initialScore) && Number.isFinite(finalScore) ? finalScore - initialScore : null;
  const steps = active ? [
    { label: "1. Dossier", done: Boolean(active.promptSnapshot) }, { label: "2. Retour", done: Boolean(active.initialResult?.trim()) },
    { label: "3. Écarts", done: Boolean(active.initialVerification || Object.values(active.requirementReview || {}).some((value) => value !== "Non vérifiable")) },
    { label: "4. Correction", done: Boolean(active.correctedResult?.trim()) }, { label: "5. Bilan", done: Boolean(active.finalVerification || active.learningProposal?.trim()) },
  ] : [];
  return <div>
    <div className="p-4 rounded-xl bg-surface border border-app mb-5"><p className="text-13 text-cream font-medium">Nouveau cycle de réalisation</p><p className="text-10 text-slate-600 mt-1 mb-3">Le dossier et les exigences sont figés au moment de la création afin de pouvoir comparer honnêtement le résultat avec ce qui a réellement été demandé.</p><div className="grid grid-cols-1 sm:grid-cols-2 gap-2"><input value={providerDraft} onChange={(event) => setProviderDraft(event.target.value)} placeholder="IA ou outil utilisé (facultatif)" className="bg-surface-2 border border-app rounded-lg px-3 py-2 text-11 placeholder:text-slate-600" /><input value={objectiveDraft} onChange={(event) => setObjectiveDraft(event.target.value)} placeholder="Objectif de cette tentative" className="bg-surface-2 border border-app rounded-lg px-3 py-2 text-11 placeholder:text-slate-600" /></div><button onClick={createRealization} className="mt-3 text-11 px-3 py-1.5 rounded-full bg-amber-400 text-app">Créer et figer le dossier</button></div>
    {realizations.length > 0 && <div className="flex gap-2 overflow-x-auto mb-4">{realizations.map((item, index) => <button key={item.id} onClick={() => setActiveId(item.id)} className={`shrink-0 text-10 px-3 py-1.5 rounded-full border ${active?.id === item.id ? "bg-violet-400/10 border-violet-400/30 text-violet-200" : "border-app text-slate-500"}`}>Cycle {realizations.length - index} · {new Date(item.createdAt).toLocaleDateString("fr-FR")}</button>)}</div>}
    {!active ? <div className="p-6 rounded-xl border border-dashed border-app text-center text-sm text-slate-500">Aucune réalisation — crée le premier cycle lorsque tu envoies le dossier à une IA ou un outil.</div> : <div>
      <div className="grid grid-cols-5 gap-1 mb-5">{steps.map((step) => <div key={step.label} className={`p-2 rounded-lg border text-center text-9 ${step.done ? "bg-emerald-400/5 border-emerald-400/20 text-emerald-300" : "bg-surface border-app text-slate-600"}`}>{step.done ? "✓ " : "○ "}{step.label}</div>)}</div>
      <div className="p-4 rounded-xl bg-surface border border-app mb-4"><p className="text-11 uppercase text-amber-300">1. Dossier envoyé — version figée</p><p className="text-10 text-slate-500 mt-1">{active.provider} · {active.objective} · {active.requirementsSnapshot.length} exigence(s)</p><textarea readOnly value={active.promptSnapshot} rows={6} className="w-full mt-3 bg-surface-2 border border-app rounded-lg px-3 py-2 text-10 font-mono-data text-slate-500" /></div>
      <div className="p-4 rounded-xl bg-surface border border-app mb-4"><div className="flex items-center justify-between gap-3"><p className="text-11 uppercase text-amber-300">2. Résultat initial et retour humain</p><button onClick={copyReportPrompt} className="shrink-0 text-9 px-2 py-1 rounded-full border border-amber-400/30 text-amber-300">{reportPromptCopied ? "Demande copiée ✓" : "Copier une demande de compte-rendu à l'IA"}</button></div><textarea value={active.initialResult} onChange={(event) => updateActive({ initialResult: event.target.value, status: "Résultat initial reçu" })} rows={8} placeholder="Colle la réponse, le rapport, le code ou la description du résultat obtenu…" className="w-full mt-3 bg-surface-2 border border-app rounded-lg px-3 py-2 text-11 placeholder:text-slate-600" /><div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">{REALIZATION_REVIEW_FIELDS.map(([id, label]) => <label key={id} className="text-10 text-slate-500">{label}<select value={active.humanReview?.[id] || "Non vérifié"} onChange={(event) => updateActive({ humanReview: { ...(active.humanReview || {}), [id]: event.target.value } })} className="block w-full mt-1 bg-surface-2 border border-app rounded-lg px-2 py-1.5 text-11 text-slate-300">{REALIZATION_REVIEW_VALUES.map((value) => <option key={value}>{value}</option>)}</select></label>)}</div><textarea value={active.freeFeedback || ""} onChange={(event) => updateActive({ freeFeedback: event.target.value })} rows={3} placeholder="Ce qui fonctionne, manque, semble inutile ou dangereux…" className="w-full mt-3 bg-surface-2 border border-app rounded-lg px-3 py-2 text-11 placeholder:text-slate-600" /></div>
      <div className="p-4 rounded-xl bg-surface border border-app mb-4"><div className="flex items-center justify-between gap-3"><div><p className="text-11 uppercase text-amber-300">3. Vérification des exigences et écarts</p><p className="text-10 text-slate-600 mt-1">Évaluation humaine gratuite ou vérification IA volontaire.</p></div><button onClick={() => verify("initial")} disabled={verifying || !active.initialResult?.trim()} className="text-10 px-3 py-1.5 rounded-full bg-amber-400 text-app disabled:opacity-40">{verifying === "initial" ? "Vérification…" : "Vérifier avec l’IA"}</button></div><div className="space-y-2 mt-3">{active.requirementsSnapshot.map((requirement) => <div key={requirement.id} className="p-3 rounded-lg bg-surface-2 border border-app"><p className="text-11 text-slate-300">{requirement.label}</p><select value={active.requirementReview?.[requirement.id] || "Non vérifiable"} onChange={(event) => updateActive({ requirementReview: { ...(active.requirementReview || {}), [requirement.id]: event.target.value } })} className="mt-2 bg-surface border border-app rounded-lg px-2 py-1 text-10 text-slate-400">{REQUIREMENT_RESULT_VALUES.map((value) => <option key={value}>{value}</option>)}</select></div>)}</div>{verifyError && <p className="text-10 text-red-300 mt-2">{verifyError}</p>}{active.initialVerification && <div className="mt-3 p-3 rounded-xl bg-violet-400/5 border border-violet-400/20"><p className="text-xl font-display text-amber-400">{active.initialVerification.score}/100 <span className="text-11 text-slate-400">{active.initialVerification.verdict}</span></p>{active.initialVerification.ecarts?.map((item, index) => <p key={index} className="text-10 text-slate-400 mt-1">• [{item.gravite}] {item.exigence} — {item.correction}</p>)}</div>}
        {/* Vérification manuelle (27/08/2026) — même logique que le "Mode
            Assistant bêta" de l'étape Diagnostic : copier une demande déjà
            pré-remplie, la coller dans un autre outil/IA, coller sa réponse
            ici. Utile sans crédit API, ou pour faire vérifier le résultat par
            une IA différente de celle qui l'a construit. */}
        <div className="mt-3 pt-3 border-t border-app-soft">
          <button onClick={() => setManualVerifyOpen(!manualVerifyOpen)} disabled={!active.initialResult?.trim()} className="text-10 text-amber-300/80 disabled:opacity-40">{manualVerifyOpen ? "Masquer la vérification manuelle" : "Pas de crédit API ? Vérifier manuellement →"}</button>
          {manualVerifyOpen && (
            <div className="mt-3">
              <button onClick={copyManualVerifyPrompt} className="text-10 px-3 py-1.5 rounded-full bg-amber-400 text-app">{manualVerifyCopied ? "Demande copiée ✓" : "1. Copier la demande de vérification"}</button>
              <textarea readOnly value={buildVerificationPrompt(active.promptSnapshot, active.initialResult)} onFocus={(event) => event.target.select()} rows={5} className="w-full mt-3 bg-surface-2 border border-app rounded-lg px-3 py-2 text-10 font-mono-data text-slate-500" />
              <textarea value={manualVerifyText} onChange={(event) => setManualVerifyText(event.target.value)} rows={6} placeholder="2. Colle ici la réponse JSON obtenue…" className="w-full mt-3 bg-surface-2 border border-app rounded-lg px-3 py-2 text-11 font-mono-data placeholder:text-slate-600" />
              <button onClick={importManualVerification} disabled={!manualVerifyText.trim()} className="mt-2 text-10 px-3 py-1.5 rounded-full bg-emerald-400 text-app disabled:opacity-40">3. Vérifier et enregistrer</button>
              {manualVerifyError && <p className="text-10 text-red-300 mt-2">{manualVerifyError}</p>}
            </div>
          )}
        </div>
      </div>
      <div className="p-4 rounded-xl bg-surface border border-app mb-4"><p className="text-11 uppercase text-amber-300">4. Correction et nouvelle version</p>{active.initialVerification?.instructionCorrective && <div className="p-3 rounded-lg bg-amber-400/5 border border-amber-400/20 mt-3"><p className="text-9 uppercase text-amber-300">Instruction corrective prête à renvoyer</p><p className="text-11 text-slate-300 mt-1 whitespace-pre-line">{active.initialVerification.instructionCorrective}</p></div>}<textarea value={active.correctedResult || ""} onChange={(event) => updateActive({ correctedResult: event.target.value, status: "Correction reçue" })} rows={8} placeholder="Colle ici le résultat après correction…" className="w-full mt-3 bg-surface-2 border border-app rounded-lg px-3 py-2 text-11 placeholder:text-slate-600" /><button onClick={() => verify("final")} disabled={verifying || !active.correctedResult?.trim()} className="mt-2 text-10 px-3 py-1.5 rounded-full bg-amber-400 text-app disabled:opacity-40">{verifying === "final" ? "Vérification…" : "Vérifier la version corrigée"}</button></div>
      <div className="p-4 rounded-xl bg-surface border border-app mb-4"><p className="text-11 uppercase text-amber-300">5. Questionner l’IA constructrice</p><p className="text-10 text-slate-600 mt-1">Copie ce questionnaire dans la conversation Codex, Claude Code, OpenAI ou tout autre outil qui a réalisé l’application. Sa réponse reste une source à vérifier, jamais une règle automatique.</p><div className="flex flex-wrap gap-2 mt-3"><button onClick={copyDebriefPrompt} className="text-10 px-3 py-1.5 rounded-full bg-violet-400/10 border border-violet-400/25 text-violet-200">{debriefCopied ? "Questionnaire copié ✓" : "Copier le questionnaire de débrief"}</button></div><textarea readOnly value={active.builderDebriefPrompt || buildBuilderDebriefPrompt(active)} rows={5} onFocus={(event) => event.target.select()} className="w-full mt-3 bg-surface-2 border border-app rounded-lg px-3 py-2 text-10 font-mono-data text-slate-500" /><textarea value={active.builderDebriefResponse || ""} onChange={(event) => updateActive({ builderDebriefResponse: event.target.value, status: "Débrief reçu" })} rows={7} placeholder="Colle ici la réponse de l’IA qui a construit l’application…" className="w-full mt-3 bg-surface-2 border border-app rounded-lg px-3 py-2 text-11 placeholder:text-slate-600" /><button onClick={analyzeDebrief} disabled={debriefing || !active.builderDebriefResponse?.trim()} className="mt-2 text-10 px-3 py-1.5 rounded-full bg-amber-400 text-app disabled:opacity-40">{debriefing ? "Formalisation…" : "Formaliser pour le moteur avec l’IA"}</button>{debriefError && <p className="text-10 text-red-300 mt-2">{debriefError}</p>}{active.builderDebriefSynthesis && <div className="mt-3 p-3 rounded-lg bg-emerald-400/5 border border-emerald-400/20"><p className="text-10 text-emerald-300">{active.builderDebriefSynthesis.confidence} · portée {active.builderDebriefSynthesis.scope}</p><p className="text-11 text-slate-300 mt-1">{active.builderDebriefSynthesis.learningProposal}</p>{active.builderDebriefSynthesis.counterExample && <p className="text-10 text-slate-500 mt-2">Contre-exemple à rechercher : {active.builderDebriefSynthesis.counterExample}</p>}</div>}</div>
      <div className="p-4 rounded-xl bg-surface border border-app"><p className="text-11 uppercase text-amber-300">6. Bilan et apprentissage</p>{scoreDelta !== null && <div className="grid grid-cols-3 gap-2 mt-3"><div className="p-3 rounded-lg bg-surface-2 text-center"><p className="text-lg text-slate-300">{initialScore}</p><p className="text-9 text-slate-600">Avant</p></div><div className="p-3 rounded-lg bg-surface-2 text-center"><p className="text-lg text-slate-300">{finalScore}</p><p className="text-9 text-slate-600">Après</p></div><div className="p-3 rounded-lg bg-surface-2 text-center"><p className={`text-lg ${scoreDelta > 0 ? "text-emerald-300" : scoreDelta < 0 ? "text-red-300" : "text-slate-300"}`}>{scoreDelta > 0 ? "+" : ""}{scoreDelta}</p><p className="text-9 text-slate-600">Évolution</p></div></div>}<textarea value={active.learningProposal || ""} onChange={(event) => updateActive({ learningProposal: event.target.value })} rows={4} placeholder="Qu’est-ce que NANDĒM devrait retenir de ce cycle ? Une exigence oubliée, inutile, ambiguë, un test manquant…" className="w-full mt-3 bg-surface-2 border border-app rounded-lg px-3 py-2 text-11 placeholder:text-slate-600" /><button onClick={() => onAddLearning(active, () => updateActive({ learningPromoted: true }))} disabled={!active.learningProposal?.trim() || active.learningPromoted} className="mt-2 text-10 px-3 py-1.5 rounded-full bg-amber-400 text-app disabled:opacity-40">{active.learningPromoted ? "Envoyé vers Observer" : "Proposer comme observation"}</button><p className="text-9 text-slate-600 mt-2">Un seul cycle crée une observation, jamais une règle universelle. La formalisation et la validation du Socle restent nécessaires.</p></div>
    </div>}
  </div>;
}
function PreDiscoveryProject({ project, onUpdateProject, onComplete, onCodeExistant, customGoals, questionOverrides, studioName, feedbackEmail, tarifHoraire }) {
  const [tab, setTab] = useState("apercu");
  const tabs = [["apercu", "Aperçu"], ["diagnostic", "Diagnostic"], ["conception", "Conception & Prompt"], ["realisation", "Réalisation"], ["documents", "Documents"], ["conversation", "Conversation"]];
  return <div className="max-w-2xl mx-auto px-5 py-6">
    <div className="flex gap-1.5 overflow-x-auto pb-1 mb-5 -mx-1 px-1">{tabs.map(([id, label]) => { const locked = LOCKED_WITHOUT_SYNTHESIS_TABS.has(id); return <button key={id} onClick={() => setTab(id)} title={locked ? "Se débloque une fois la synthèse du diagnostic prête" : undefined} className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-12 border transition-colors whitespace-nowrap ${tab === id ? "bg-amber-400 text-app border-amber-400" : locked ? "border-app-soft text-slate-600" : "border-app text-slate-400"}`}>{locked && <Lock size={10} />}{label}</button>; })}</div>
    {/* Tous les panneaux restent montés en permanence — seul l'affichage
        change (display:none) — sinon changer d'onglet démonte DiscoveryFlow
        et efface tout ce que la personne avait déjà répondu (bug réel vécu :
        ajouter un document, revenir sur Diagnostic, tout est reparti à zéro). */}
    <div style={{ display: tab === "apercu" ? "block" : "none" }}>
      <h2 className="font-display text-lg mb-1">Informations du projet</h2>
      <p className="text-11 text-slate-600 mb-4">Ces informations restent accessibles avant, pendant et après le diagnostic.</p>
      <EntrepriseSection project={project} onUpdate={(entreprise) => onUpdateProject({ entreprise })} />
      <ClientSection project={project} onUpdate={(client) => onUpdateProject({ client })} />
      <PipelineSection project={project} onUpdate={(pipeline) => onUpdateProject({ pipeline })} />
      <FinanceSection project={project} onUpdateProject={onUpdateProject} studioName={studioName} feedbackEmail={feedbackEmail} tarifHoraire={tarifHoraire} />
      <button onClick={() => setTab("diagnostic")} className="w-full py-2.5 rounded-xl bg-amber-400 text-app text-sm">Commencer le diagnostic</button>
    </div>
    <div style={{ display: tab === "diagnostic" ? "block" : "none" }}>
      <h2 className="font-display text-lg mb-1">Diagnostic et cahier des charges</h2>
      <p className="text-11 text-slate-600 mb-4">Les réponses formeront le cahier des charges du projet.</p>
      <DiscoveryFlow onComplete={onComplete} categorie={project.categorie} onCodeExistant={onCodeExistant} customGoals={customGoals} questionOverrides={questionOverrides} />
    </div>
    <div style={{ display: tab === "conception" ? "block" : "none" }} className="p-5 rounded-xl bg-surface border border-app">
      <h2 className="font-display text-lg mb-2">Suggestions d'idées, conception et prompt</h2>
      <p className="text-13 text-slate-400">Termine le diagnostic pour générer des suggestions adaptées, la conception et le prompt de construction.</p>
      <button onClick={() => setTab("diagnostic")} className="mt-3 text-11 px-3 py-1.5 rounded-full bg-amber-400 text-app">Commencer le diagnostic</button>
    </div>
    <div style={{ display: tab === "realisation" ? "block" : "none" }} className="p-5 rounded-xl bg-surface border border-app">
      <h2 className="font-display text-lg mb-2">Réalisation</h2>
      <p className="text-13 text-slate-400">Cette étape se débloquera après la conception du projet.</p>
    </div>
    <div style={{ display: tab === "documents" ? "block" : "none" }}>
      <DocumentsSection project={project} onUpdate={(documents) => onUpdateProject({ documents })} />
    </div>
    <div style={{ display: tab === "conversation" ? "block" : "none" }}>
      <ConversationSection project={project} />
    </div>
  </div>;
}

function ProjectDetail({ project, onAddToLibrary, libraryIds, onSetConception, onUpdateProject, onRetrySynthesis, promptAddendum, engineRequirements, onSaveFeedback, onArchiveProject, studioName, feedbackEmail, tarifHoraire }) {
  const s = project.discovery?.synthesis; const error = project.discovery?.error;
  // Tous les hooks doivent s'exécuter à chaque rendu, dans le même ordre —
  // donc TOUS déclarés ici, avant tout retour conditionnel. Le bug d'origine
  // (React error #310) venait de hooks déclarés après le "if (!s) return",
  // exécutés seulement une fois la synthèse disponible : le nombre de hooks
  // changeait d'un rendu à l'autre, ce que React interdit strictement.
  const [generatingConception, setGeneratingConception] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [copiedWhat, setCopiedWhat] = useState(null);
  const [ideas, setIdeas] = useState(null);
  const [loadingIdeas, setLoadingIdeas] = useState(false);
  const [projectTab, setProjectTab] = useState("apercu");
  const [showTextFallback, setShowTextFallback] = useState(null); // texte affiché si le presse-papier échoue
  const [feedbackText, setFeedbackText] = useState("");
  const [notesDraft, setNotesDraft] = useState(project.notesComplementaires || "");
  const [notesSaved, setNotesSaved] = useState(false);
  const [feedbackSaved, setFeedbackSaved] = useState(false);
  const [buildNoteText, setBuildNoteText] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [manualSynthesisOpen, setManualSynthesisOpen] = useState(false);
  const [manualSynthesisText, setManualSynthesisText] = useState("");
  const [manualSynthesisError, setManualSynthesisError] = useState(null);
  const [manualPromptCopied, setManualPromptCopied] = useState(false);
  const PROJECT_TABS = [
    { id: "apercu", label: "Aperçu" },
    { id: "diagnostic", label: "Diagnostic" },
    { id: "conception", label: "Conception & Prompt" },
    { id: "realisation", label: "Réalisation" },
    { id: "documents", label: "Documents" },
    { id: "conversation", label: "Conversation" },
  ];
  async function fetchIdeas() { setLoadingIdeas(true); setIdeas(await suggestMetierIdeas(s)); setLoadingIdeas(false); }
  if (!s) {
    const answers = project.discovery?.answers || {};
    const betaPrompt = buildSynthesisPrompt(answers, project.conversation);
    async function copyBetaPrompt() {
      try { await navigator.clipboard.writeText(betaPrompt); setManualPromptCopied(true); setTimeout(() => setManualPromptCopied(false), 1800); }
      catch { setManualSynthesisError("Copie automatique indisponible : sélectionne le prompt affiché."); }
    }
    function importManualSynthesis() {
      try {
        const parsed = extractJSON(manualSynthesisText);
        const required = ["resume", "besoinReel", "activite", "utilisateurs", "objetsMetier", "processusMetier", "informationsManipulees", "difficultes", "frustrations", "opportunitesAutomatisation", "fonctionnalitesV1", "fonctionnalitesFutures", "contraintes", "priorites", "complexite", "questionsOuvertes"];
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("La réponse doit être un objet JSON.");
        const missing = required.filter((key) => !(key in parsed));
        if (missing.length) throw new Error(`Clés manquantes : ${missing.join(", ")}`);
        if (!["Faible", "Moyenne", "Élevée"].includes(parsed.complexite)) throw new Error("complexite doit valoir Faible, Moyenne ou Élevée.");
        onUpdateProject({ discovery: { answers, synthesis: parsed, error: null }, manualSynthesis: { mode: "assistant-beta", importedAt: new Date().toISOString(), promptSnapshot: betaPrompt, responseSnapshot: manualSynthesisText } });
        setManualSynthesisError(null);
      } catch (error) { setManualSynthesisError(`Réponse non importée : ${error.message}`); }
    }
    return (
      <div className="max-w-2xl mx-auto px-5 py-6">
        <div className="flex gap-1.5 overflow-x-auto pb-1 mb-5 -mx-1 px-1">
          {PROJECT_TABS.map((tabItem) => { const locked = LOCKED_WITHOUT_SYNTHESIS_TABS.has(tabItem.id); return (
            <button key={tabItem.id} onClick={() => setProjectTab(tabItem.id)} title={locked ? "Se débloque une fois la synthèse du diagnostic prête" : undefined} className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-12 border transition-colors whitespace-nowrap ${projectTab === tabItem.id ? "bg-amber-400 text-app border-amber-400" : locked ? "border-app-soft text-slate-600" : "border-app text-slate-400"}`}>{locked && <Lock size={10} />}{tabItem.label}</button>
          ); })}
        </div>
        {projectTab === "apercu" && <div>
          <h2 className="font-display text-lg mb-1">Informations du projet</h2>
          <p className="text-11 text-slate-600 mb-4">Toujours accessibles, même si la synthèse n'est pas encore disponible.</p>
          <EntrepriseSection project={project} onUpdate={(entreprise) => onUpdateProject({ entreprise })} />
          <ClientSection project={project} onUpdate={(client) => onUpdateProject({ client })} />
          <PipelineSection project={project} onUpdate={(pipeline) => onUpdateProject({ pipeline })} />
          <FinanceSection project={project} onUpdateProject={onUpdateProject} studioName={studioName} feedbackEmail={feedbackEmail} tarifHoraire={tarifHoraire} />
          <div className="p-4 rounded-xl bg-amber-400/5 border border-amber-400/20"><p className="text-13 text-amber-200">La synthèse doit être enregistrée pour afficher le résumé, les priorités et la complexité.</p><button onClick={() => setProjectTab("diagnostic")} className="mt-2 text-11 px-3 py-1.5 rounded-full bg-amber-400 text-app">Ouvrir le diagnostic</button></div>
        </div>}
        {projectTab === "diagnostic" && <div>
        <div className="mb-5 p-3 rounded-xl bg-red-400/10 border border-red-400/20 text-red-300 text-sm">{error || "La synthèse n'a pas encore été générée."}</div>
        <button onClick={async () => { setRetrying(true); await onRetrySynthesis(); setRetrying(false); }} disabled={retrying}
          className="w-full mb-4 py-2.5 rounded-xl bg-amber-400 text-app text-sm flex items-center justify-center gap-2 disabled:opacity-50">
          {retrying ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}{retrying ? "Génération…" : error ? "Réessayer la synthèse" : "Générer la synthèse"}
        </button>
        <div className="mb-6 p-4 rounded-xl bg-surface border border-app"><div className="flex items-start justify-between gap-3"><div><p className="text-13 text-slate-300 font-medium">Pas de crédit API ? Mode Assistant bêta</p><p className="text-10 text-slate-500 mt-1">Solution de secours uniquement — copie la demande dans Codex ou une autre IA (via ton abonnement, pas l'API), puis colle ici son JSON. NANDĒM contrôle la structure et conserve les deux versions comme preuve.</p></div><button onClick={() => setManualSynthesisOpen(!manualSynthesisOpen)} className="text-10 text-amber-300 shrink-0">{manualSynthesisOpen ? "Réduire" : "Ouvrir"}</button></div>{manualSynthesisOpen && <div className="mt-3"><button onClick={copyBetaPrompt} className="text-10 px-3 py-1.5 rounded-full bg-amber-400 text-app">{manualPromptCopied ? "Demande copiée ✓" : "1. Copier la demande pour Codex"}</button><textarea readOnly value={betaPrompt} onFocus={(event) => event.target.select()} rows={5} className="w-full mt-3 bg-surface-2 border border-app rounded-lg px-3 py-2 text-10 font-mono-data text-slate-500" /><textarea value={manualSynthesisText} onChange={(event) => setManualSynthesisText(event.target.value)} rows={8} placeholder="2. Colle ici le JSON produit par Codex…" className="w-full mt-3 bg-surface-2 border border-app rounded-lg px-3 py-2 text-11 font-mono-data placeholder:text-slate-600" /><button onClick={importManualSynthesis} disabled={!manualSynthesisText.trim()} className="mt-2 text-10 px-3 py-1.5 rounded-full bg-emerald-400 text-app disabled:opacity-40">3. Vérifier et enregistrer</button>{manualSynthesisError && <p className="text-10 text-red-300 mt-2">{manualSynthesisError}</p>}</div>}</div>
        <p className="text-11 uppercase tracking-wider text-slate-500 mb-3">Réponses brutes (conservées)</p>
        <div className="space-y-3">
          {Object.entries(answers).map(([id, a]) => (
            <div key={id} className="pb-3 border-b border-app-soft last:border-0">
              <p className="text-11 text-amber-400/70">{a.label || id}</p>
              <p className="text-13 text-slate-300 mt-0.5">{a.text}</p>
            </div>
          ))}
        </div>
        </div>}
        {projectTab === "conception" && <div className="p-5 rounded-xl bg-surface border border-app"><h2 className="font-display text-lg mb-2">Suggestions d'idées, conception et prompt</h2><p className="text-13 text-slate-400">Cette section est prête, mais elle a besoin de la synthèse du diagnostic pour proposer des idées pertinentes et construire le prompt sans inventer.</p><button onClick={() => setProjectTab("diagnostic")} className="mt-3 text-11 px-3 py-1.5 rounded-full bg-amber-400 text-app">Finaliser la synthèse</button></div>}
        {projectTab === "realisation" && <div className="p-5 rounded-xl bg-surface border border-app"><h2 className="font-display text-lg mb-2">Réalisation</h2><p className="text-13 text-slate-400">Le suivi de réalisation sera disponible dès que la synthèse et le prompt du projet seront prêts.</p></div>}
        {projectTab === "documents" && <DocumentsSection project={project} onUpdate={(documents) => onUpdateProject({ documents })} />}
        {projectTab === "conversation" && <ConversationSection project={project} />}
      </div>
    );
  }
  const requirementSelection = selectRequirementsForProject(project, engineRequirements);
  async function generateConception() {
    setGeneratingConception(true);
    try {
      const completeConception = await buildConception(s, project.discovery?.answers?.ambiance?.text, project.validatedIdeas, project.notesComplementaires);
      onSetConception(completeConception, null);
    } catch (generationError) {
      // En cas d'échec pendant une régénération, conserver l'ancienne version
      // au lieu de la supprimer. L'utilisateur peut ainsi réessayer sans perte.
      onSetConception(project.conception || null, generationError?.message || "La génération de la conception a échoué.");
    }
    setGeneratingConception(false);
  }
  function addBuildHistoryEntry() {
    if (!buildNoteText.trim()) return;
    const entry = { id: genId(), date: new Date().toISOString(), text: buildNoteText.trim() };
    onUpdateProject({ buildHistory: [...(project.buildHistory || []), entry] });
    setBuildNoteText("");
  }
  async function copy(text, what) {
    if (!text) return;
    try {
      let copied = false;
      if (navigator.clipboard && window.isSecureContext) {
        try {
          await navigator.clipboard.writeText(text);
          copied = true;
        } catch {}
      }
      // Secours pour les aperçus intégrés et certains navigateurs mobiles où
      // Clipboard API est absente ou refusée malgré un clic utilisateur.
      if (!copied) {
        const area = document.createElement("textarea");
        area.value = text;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.opacity = "0";
        area.style.pointerEvents = "none";
        document.body.appendChild(area);
        area.focus();
        area.select();
        area.setSelectionRange(0, area.value.length);
        copied = document.execCommand("copy");
        document.body.removeChild(area);
      }
      if (!copied) throw new Error("copie refusée");
      setCopiedWhat(what); setTimeout(() => setCopiedWhat(null), 1800);
    } catch {
      setShowTextFallback({ what, text }); // le presse-papier a échoué (fréquent dans un aperçu mobile) — on montre le texte brut à sélectionner
    }
  }
  function downloadBuildPackage(format = "md") {
    const content = format === "json" ? JSON.stringify(buildPortableBuildPackage(project, promptAddendum, engineRequirements), null, 2) : buildUniversalBuildPrompt(project, promptAddendum, engineRequirements);
    const blob = new Blob([content], { type: format === "json" ? "application/json" : "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(project.nom || "projet").replace(/[^a-z0-9_-]+/gi, "-").toLowerCase()}-dossier-construction.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
  return (
    <div className="max-w-2xl mx-auto px-5 py-6">
      <div className="flex items-center justify-end gap-1.5 mb-3">
        <button onClick={() => copy(buildFullExportText(project), "archive")} className="p-2 rounded-lg hover:bg-surface text-slate-400 hover:text-slate-200 transition-colors shrink-0" title="Exporter l'archive complète">{copiedWhat === "archive" ? <Check size={16} className="text-amber-400" /> : <Download size={16} strokeWidth={1.75} />}</button>
        <button onClick={() => setConfirmDelete(true)} className="p-2 rounded-lg hover:bg-surface text-slate-400 hover:text-red-400 transition-colors shrink-0" title="Supprimer ce projet de la liste active"><Trash2 size={16} strokeWidth={1.75} /></button>
      </div>
      {confirmDelete && (
        <div className="mb-4 p-3 rounded-xl bg-red-400/10 border border-red-400/20">
          <p className="text-12 text-red-200 mb-2">Supprimer "{project.nom}" de la liste active ? Rien n'est perdu — il reste consultable et restaurable depuis Historique.</p>
          <div className="flex gap-2">
            <button onClick={() => setConfirmDelete(false)} className="flex-1 py-1.5 rounded-lg bg-surface-2 border border-app text-12 text-slate-300">Annuler</button>
            <button onClick={() => onArchiveProject(project.id)} className="flex-1 py-1.5 rounded-lg bg-red-400/80 text-app text-12 font-medium">Supprimer</button>
          </div>
        </div>
      )}
      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-5 -mx-1 px-1">
        {PROJECT_TABS.map((t) => (
          <button key={t.id} onClick={() => setProjectTab(t.id)} className={`shrink-0 px-3 py-1.5 rounded-full text-12 border transition-colors whitespace-nowrap ${projectTab === t.id ? "bg-amber-400 text-app border-amber-400" : "border-app text-slate-400"}`}>{t.label}</button>
        ))}
      </div>

      <div style={{ display: projectTab === "apercu" ? "block" : "none" }}>
        <div>
          <EntrepriseSection project={project} onUpdate={(entreprise) => onUpdateProject({ entreprise })} />
          <ClientSection project={project} onUpdate={(client) => onUpdateProject({ client })} />
          <PipelineSection project={project} onUpdate={(pipeline) => onUpdateProject({ pipeline })} />
          <FinanceSection project={project} onUpdateProject={onUpdateProject} studioName={studioName} feedbackEmail={feedbackEmail} tarifHoraire={tarifHoraire} />
          <div className="space-y-4">
            {[["resume", "Résumé"], ["priorites", "Priorité"], ["complexite", "Complexité estimée"]].map(([key, label]) => (
              <div key={key} className="pb-4 border-b border-app-soft last:border-0">
                <p className="text-11 uppercase tracking-wider text-amber-400/70 mb-1">{label}</p>
                <p className="text-14 text-slate-300 leading-relaxed whitespace-pre-line">{s[key] || "Non renseigné"}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: projectTab === "diagnostic" ? "block" : "none" }}>
        <div>
          <h2 className="font-display text-lg mb-2">Cahier des charges</h2>
          {error && <div className="mb-5 p-3 rounded-xl bg-red-400/10 border border-red-400/20 text-red-300 text-sm">{error}</div>}
          <div className="space-y-4">{SYNTHESIS_FIELDS.map(([key, label]) => { const libId = `${project.id}:${key}`; const inLib = libraryIds.has(libId); const fieldWhat = `field:${key}`; return (<div key={key} className="pb-4 border-b border-app-soft last:border-0 group"><div className="flex items-center justify-between mb-1.5"><p className="text-11 uppercase tracking-wider text-amber-400/70">{label}</p><div className="flex items-center gap-1.5"><button onClick={() => copy(s[key], fieldWhat)} disabled={!s[key] || s[key] === "Non renseigné"} className="text-10 px-2 py-0.5 rounded-full border border-app text-slate-500 hover:border-amber-400/30 hover:text-amber-300 disabled:opacity-30 transition-colors flex items-center gap-1">{copiedWhat === fieldWhat ? <Check size={10} /> : <Copy size={10} />}{copiedWhat === fieldWhat ? "Copié" : "Copier"}</button><button onClick={() => !inLib && onAddToLibrary(project, key, label, s[key])} disabled={inLib || !s[key] || s[key] === "Non renseigné"} className={`text-10 px-2 py-0.5 rounded-full border flex items-center gap-1 transition-colors ${inLib ? "border-amber-400/40 text-amber-300" : "border-app text-slate-500 hover:border-amber-400/30 hover:text-amber-300 disabled:opacity-30"}`}>{inLib ? <Check size={10} /> : <Plus size={10} />}{inLib ? "Dans la bibliothèque" : "Ajouter"}</button></div></div><p className="text-14 text-slate-300 leading-relaxed whitespace-pre-line">{s[key] || "Non renseigné"}</p></div>); })}</div>
          <div className="border-t border-app pt-5 mt-6">
            <h3 className="font-display text-base mb-2">Notes complémentaires</h3>
            <p className="text-11 text-slate-600 mb-3">Ce que tu ajoutes après coup — une réflexion menée avec n’importe quelle IA, un expert, ou toi-même. Vient enrichir la conception et le dossier de construction, sans nouvel appel IA ici.</p>
            <textarea value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} rows={5} placeholder="Colle ou écris ici tes observations complémentaires…" className="w-full bg-surface-2 border border-app rounded-xl px-3.5 py-2.5 text-14 placeholder:text-slate-600 mb-2" />
            <button onClick={() => { onUpdateProject({ notesComplementaires: notesDraft }); setNotesSaved(true); setTimeout(() => setNotesSaved(false), 1500); }} className="text-13 bg-amber-400 text-app px-4 py-1.5 rounded-lg">{notesSaved ? "Enregistré" : "Enregistrer"}</button>
          </div>
        </div>
      </div>

      <div style={{ display: projectTab === "conception" ? "block" : "none" }}>
        <div>
          <div>
            <h3 className="font-display text-base mb-3">Suggestions pour ce métier</h3>
            <p className="text-11 text-slate-600 mb-3">Idées génériques à ce type d'activité — niveau de preuve : Hypothèse, jamais testées sur ce projet précis. Rien n'est ajouté sans toi.</p>
            {!ideas && (<button onClick={fetchIdeas} disabled={loadingIdeas} className="w-full py-2.5 rounded-xl bg-surface-2 border border-app text-sm text-slate-300 hover:border-amber-400/30 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">{loadingIdeas ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}{loadingIdeas ? "Recherche…" : "Suggérer des idées"}</button>)}
            {ideas && ideas.length === 0 && <p className="text-12 text-slate-600">Rien de solide à proposer cette fois.</p>}
            {ideas && ideas.length > 0 && (
              <div className="space-y-2">
                {ideas.map((idea, i) => {
                  const libId = `${project.id}:idea${i}`; const inLib = libraryIds.has(libId);
                  const included = (project.validatedIdeas || []).some((v) => v.label === idea.label);
                  function toggleInclude() {
                    const current = project.validatedIdeas || [];
                    const next = included ? current.filter((v) => v.label !== idea.label) : [...current, idea];
                    onUpdateProject({ validatedIdeas: next });
                  }
                  return (
                    <div key={i} className="p-3 rounded-xl bg-surface border border-app">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-13 text-cream font-medium">{idea.label}</p>
                          <p className="text-12 text-slate-400 mt-1">{idea.description}</p>
                        </div>
                      </div>
                      <div className="flex gap-1.5 mt-2.5 flex-wrap">
                        <button onClick={toggleInclude}
                          className={`text-10 px-2 py-0.5 rounded-full border flex items-center gap-1 transition-colors ${included ? "border-amber-400/40 text-amber-300 bg-amber-400/5" : "border-app text-slate-500 hover:border-amber-400/30 hover:text-amber-300"}`}>
                          {included ? <Check size={10} /> : <Plus size={10} />}{included ? "Incluse dans le prompt" : "Inclure dans le prompt"}
                        </button>
                        <button onClick={() => !inLib && onAddToLibrary(project, `idea${i}`, `Suggestion métier : ${idea.label}`, idea.description)} disabled={inLib}
                          className={`text-10 px-2 py-0.5 rounded-full border flex items-center gap-1 transition-colors ${inLib ? "border-amber-400/40 text-amber-300" : "border-app text-slate-500 hover:border-amber-400/30 hover:text-amber-300"}`}>
                          {inLib ? <Check size={10} /> : <Plus size={10} />}{inLib ? "Dans la bibliothèque" : "Ajouter à la bibliothèque"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="border-t border-app pt-5 mt-6">
            <h3 className="font-display text-base mb-3">Conception technique</h3>
            {project.conceptionError && <div className="mb-3 p-3 rounded-xl bg-red-400/10 border border-red-400/20 text-red-300 text-12">{project.conceptionError}</div>}
            {!project.conception && (<button onClick={generateConception} disabled={generatingConception} className="w-full py-2.5 rounded-xl bg-surface-2 border border-app text-sm text-slate-300 hover:border-amber-400/30 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">{generatingConception ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}{generatingConception ? "Génération…" : "Générer la conception (architecture, écrans, données)"}</button>)}
            {project.conception && (<><div className="p-4 rounded-xl bg-surface border border-app text-13 text-slate-300 whitespace-pre-line leading-relaxed mb-3">{project.conception}</div><div className="flex gap-2"><button onClick={generateConception} disabled={generatingConception} className="px-3 py-2.5 rounded-xl bg-surface-2 border border-app text-12 text-slate-400 flex items-center justify-center gap-1.5 disabled:opacity-50">{generatingConception ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}{generatingConception ? "Régénération…" : "Régénérer"}</button><button onClick={() => copy(buildUniversalBuildPrompt(project, promptAddendum, engineRequirements), "build-package")} className="flex-1 py-2.5 rounded-xl bg-amber-400 text-app text-sm flex items-center justify-center gap-2">{copiedWhat === "build-package" ? <Check size={15} /> : <Copy size={15} />}{copiedWhat === "build-package" ? "Dossier copié" : "Copier le dossier de construction"}</button></div><div className="grid grid-cols-2 gap-2 mt-2"><button onClick={() => downloadBuildPackage("md")} className="py-2 rounded-xl border border-app text-12 text-slate-400 flex items-center justify-center gap-2"><Download size={14} />Markdown universel</button><button onClick={() => downloadBuildPackage("json")} className="py-2 rounded-xl border border-app text-12 text-slate-400 flex items-center justify-center gap-2"><Download size={14} />Source JSON</button></div><div className="mt-3 p-3 rounded-xl bg-amber-400/5 border border-amber-400/20"><p className="text-11 text-amber-300">Socle appliqué : charte d’excellence + {requirementSelection.selected.length} exigence(s) pertinente(s)</p>{requirementSelection.selected.length > 0 && <div className="mt-2 space-y-1">{requirementSelection.selected.map(({ requirement, reason }) => <p key={requirement.id} className="text-10 text-slate-400">• {requirement.label} — {reason}</p>)}</div>}</div>
              <div className="mt-3 p-3 rounded-xl bg-surface-2 border border-app">
                <p className="text-11 text-slate-500 mb-2">Un retour après avoir utilisé ce prompt ? (ce qui a manqué, ce qui a bien marché — sert à améliorer les prochains)</p>
                <textarea value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} rows={2} placeholder="Facultatif…" className="w-full bg-surface border border-app rounded-lg px-3 py-2 text-12 mb-2" />
                <button onClick={() => { onSaveFeedback(project.nom, feedbackText); setFeedbackText(""); setFeedbackSaved(true); setTimeout(() => setFeedbackSaved(false), 1500); }} disabled={!feedbackText.trim()}
                  className="text-11 px-3 py-1.5 rounded-full bg-amber-400 text-app disabled:opacity-40">{feedbackSaved ? "Enregistré" : "Enregistrer ce retour"}</button>
              </div>
              <div className="mt-3 p-3 rounded-xl bg-surface-2 border border-app">
                <p className="text-11 text-slate-500 mb-2">Historique de construction — si tu reviens plus tard ajouter une fonctionnalité, le prochain prompt copié inclura automatiquement ce qui est déjà fait, pour ne pas repartir de zéro.</p>
                {project.buildHistory?.length > 0 && (
                  <div className="space-y-1.5 mb-2">
                    {project.buildHistory.map((h) => (
                      <div key={h.id} className="text-12 text-slate-300 px-2.5 py-1.5 rounded-lg bg-surface border border-app-soft">
                        <span className="text-10 text-slate-500 font-mono-data mr-1.5">{new Date(h.date).toLocaleDateString("fr-FR")}</span>{h.text}
                      </div>
                    ))}
                  </div>
                )}
                <textarea value={buildNoteText} onChange={(e) => setBuildNoteText(e.target.value)} rows={2} placeholder="Ex : V1 construite (caisse + stock) — commandes pas encore faites…" className="w-full bg-surface border border-app rounded-lg px-3 py-2 text-12 mb-2" />
                <button onClick={addBuildHistoryEntry} disabled={!buildNoteText.trim()} className="text-11 px-3 py-1.5 rounded-full bg-amber-400 text-app disabled:opacity-40">Ajouter à l'historique</button>
              </div>
            </>)}
          </div>
          {project.codeExistant && (
            <div className="border-t border-app pt-5 mt-6">
              <h3 className="font-display text-base mb-2">Code existant (Mode Reprise)</h3>
              <div className="p-4 rounded-xl bg-surface border border-app text-13 text-slate-300 whitespace-pre-line leading-relaxed">{project.codeExistant}</div>
            </div>
          )}
          {showTextFallback && (
            <div className="border-t border-app pt-5 mt-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-11 uppercase tracking-wider text-red-300">Copie automatique indisponible ici — sélectionne le texte manuellement</p>
                <button onClick={() => setShowTextFallback(null)} className="text-slate-500 text-11">Fermer</button>
              </div>
              <textarea readOnly value={showTextFallback.text} onFocus={(e) => e.target.select()}
                className="w-full h-48 bg-surface border border-app rounded-xl p-3 text-11 text-slate-300 font-mono-data" />
            </div>
          )}
        </div>
      </div>

      <div style={{ display: projectTab === "realisation" ? "block" : "none" }}>
        <RealizationCycle project={project} engineRequirements={engineRequirements} promptAddendum={promptAddendum} onUpdateProject={onUpdateProject} onAddLearning={(realization, onDone) => onAddToLibrary(project, realization.id, "Retour de réalisation", realization.learningProposal, onDone)} />
      </div>

      {projectTab === "documents" && (
        <DocumentsSection project={project} onUpdate={(documents) => onUpdateProject({ documents })} />
      )}

      {projectTab === "conversation" && (
        <ConversationSection project={project} />
      )}
    </div>
  );
}
function LibraryEntryPicker({ entryText, entryLabel, onConfirm, onCancel }) {
  const [type, setType] = useState("connaissance");
  const [category, setCategory] = useState("specifique");
  const [justification, setJustification] = useState("");
  const [source, setSource] = useState("");
  const [niveauPreuve, setNiveauPreuve] = useState("Hypothèse");
  const [suggestion, setSuggestion] = useState(null);
  const [suggesting, setSuggesting] = useState(false);
  const [categoryTouched, setCategoryTouched] = useState(false);
  useEffect(() => {
    let cancelled = false;
    if (!entryText) return;
    setSuggesting(true);
    suggestGenericiteLevel(entryText, entryLabel).then((result) => {
      if (cancelled || !result?.niveau) { setSuggesting(false); return; }
      setSuggestion(result);
      if (!categoryTouched) setCategory(result.niveau);
      setSuggesting(false);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryText]);
  function pickCategory(id) { setCategory(id); setCategoryTouched(true); }
  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-panel border border-app rounded-2xl p-4 w-full max-w-sm max-h-85vh overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <p className="text-11 uppercase tracking-wider text-slate-500 mb-2">Type d'élément</p>
        <div className="flex flex-wrap gap-1.5 mb-4">{LIB_TYPES.map((t) => (<button key={t.id} onClick={() => setType(t.id)} className={`text-12 px-2.5 py-1 rounded-full border ${type === t.id ? "bg-amber-400 text-app border-amber-400" : "border-app text-slate-400"}`}>{t.label}</button>))}</div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-11 uppercase tracking-wider text-slate-500">Niveau de généricité</p>
          {suggesting && <span className="text-10 text-slate-500 flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> L'IA propose…</span>}
        </div>
        {suggestion && !categoryTouched && <p className="text-10 text-amber-300/80 mb-2">Suggestion IA : {suggestion.raison}</p>}
        <div className="space-y-1.5 mb-4">{LIB_GENERICITE.map((g) => (<button key={g.id} onClick={() => pickCategory(g.id)} className={`w-full text-left px-3 py-2 rounded-xl border text-13 ${category === g.id ? "bg-surface-3" : ""} ${g.color}`}>{g.label}{suggestion?.niveau === g.id && !categoryTouched && <span className="text-9 ml-1.5 text-amber-300/70">(suggéré)</span>}</button>))}</div>
        {type === "decision" && (<div className="mb-4"><p className="text-11 uppercase tracking-wider text-slate-500 mb-2">Justification</p><textarea value={justification} onChange={(e) => setJustification(e.target.value)} placeholder="Pourquoi cette décision, quelles alternatives envisagées…" rows={2} className="w-full bg-surface-2 border border-app rounded-lg px-3 py-2 text-13 placeholder:text-slate-600" /></div>)}
        {type === "preuve" && (<div className="mb-4 space-y-2"><input value={source} onChange={(e) => setSource(e.target.value)} placeholder="Source (projet, retour client, test…)" className="w-full bg-surface-2 border border-app rounded-lg px-3 py-2 text-13 placeholder:text-slate-600" /><div className="flex flex-wrap gap-1.5">{NIVEAUX_PREUVE.map((n) => (<button key={n} onClick={() => setNiveauPreuve(n)} className={`text-11 px-2 py-1 rounded-full border ${niveauPreuve === n ? "bg-amber-400 text-app border-amber-400" : "border-app text-slate-400"}`}>{n}</button>))}</div></div>)}
        <button onClick={() => onConfirm({ type, category, justification, source, niveauPreuve })} className="w-full py-2 rounded-xl bg-amber-400 text-app text-sm">Ajouter</button>
      </div>
    </div>
  );
}
function PromotionEditor({ entry, onConfirm, onCancel }) {
  const [questionText, setQuestionText] = useState(`À propos de "${entry.fieldLabel}" : peux-tu préciser ce point pour ce projet ?`);
  const [importance, setImportance] = useState(3);
  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-panel border border-app rounded-2xl p-4 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <p className="text-13 text-cream mb-1">Promouvoir en vraie question</p>
        <p className="text-11 text-slate-500 mb-3">Sera posée dans tous les futurs diagnostics. Basé sur : {entry.text}</p>
        <textarea value={questionText} onChange={(e) => setQuestionText(e.target.value)} rows={3} className="w-full bg-surface-2 border border-app rounded-lg px-3 py-2 text-13 mb-3" />
        <p className="text-11 uppercase tracking-wider text-slate-500 mb-2">Importance</p>
        <div className="flex gap-1.5 mb-4">
          {[3, 4, 5].map((n) => (<button key={n} onClick={() => setImportance(n)} className={`flex-1 py-1.5 rounded-lg text-12 border ${importance === n ? "bg-amber-400 text-app border-amber-400" : "border-app text-slate-400"}`}>{n === 5 ? "Prioritaire" : n === 4 ? "Importante" : "Secondaire"}</button>))}
        </div>
        <div className="flex gap-2 justify-end"><button onClick={onCancel} className="text-13 text-slate-500 px-3 py-1.5">Annuler</button><button onClick={() => onConfirm(questionText, importance)} className="text-13 bg-amber-400 text-app px-4 py-1.5 rounded-lg">Valider</button></div>
      </div>
    </div>
  );
}
function PromptChatPanel({ title, description, placeholder, applyLabel, contextText, chatFn, onApply }) {
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [applied, setApplied] = useState(false);
  const scrollRef = useRef(null);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [history, busy]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    const newHistory = [...history, { role: "user", text }];
    setHistory(newHistory);
    setInput("");
    setBusy(true);
    try {
      const reply = await chatFn(newHistory, contextText);
      const match = reply.match(/PROPOSITION\s*:\s*([\s\S]+)$/);
      const cleanReply = match ? reply.slice(0, match.index).trim() : reply.trim();
      setHistory([...newHistory, { role: "assistant", text: cleanReply || reply.trim() }]);
      if (match) setDraft(match[1].trim());
    } catch (e) {
      setHistory([...newHistory, { role: "assistant", text: `Erreur (${e.message}) — réessaie.` }]);
    }
    setBusy(false);
  }
  function applyDraft() {
    if (!draft.trim()) return;
    onApply(draft.trim());
    setDraft("");
    setApplied(true);
    setTimeout(() => setApplied(false), 1800);
  }
  const [manualText, setManualText] = useState("");
  const [manualApplied, setManualApplied] = useState(false);
  function applyManual() {
    if (!manualText.trim()) return;
    onApply(manualText.trim());
    setManualText("");
    setManualApplied(true);
    setTimeout(() => setManualApplied(false), 1800);
  }

  return (
    <div className="border-t border-app pt-5 mt-6">
      <p className="text-11 uppercase tracking-wider text-slate-500 mb-2">{title}</p>
      <p className="text-10 text-slate-600 mb-3">{description}</p>
      {history.length > 0 && (
        <div ref={scrollRef} className="space-y-2 mb-3 max-h-64 overflow-y-auto">
          {history.map((m, i) => (
            <div key={i} className={`text-12 px-3 py-2 rounded-lg leading-relaxed ${m.role === "user" ? "bg-amber-400/10 text-amber-100 ml-8" : "bg-surface border border-app text-slate-300 mr-8"}`}>{m.text}</div>
          ))}
          {busy && <div className="flex items-center gap-2 text-slate-500 text-12 px-1"><Loader2 size={12} className="animate-spin" /> Réflexion…</div>}
        </div>
      )}
      <div className="flex gap-2 mb-3">
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} disabled={busy} placeholder={placeholder} className="flex-1 bg-surface-2 border border-app rounded-lg px-3 py-2 text-13 placeholder:text-slate-600 disabled:opacity-50" />
        <button onClick={send} disabled={busy || !input.trim()} className="px-3 rounded-lg bg-amber-400 text-app disabled:opacity-40 shrink-0">{busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}</button>
      </div>
      <details className="mb-3">
        <summary className="text-11 text-slate-500 hover:text-amber-300 cursor-pointer">Tu as déjà le texte (copié d'une autre session) ? Ajoute-le directement, sans discussion</summary>
        <div className="mt-2 flex gap-2">
          <textarea value={manualText} onChange={(e) => setManualText(e.target.value)} rows={3} placeholder="Colle ici une leçon déjà écrite…" className="flex-1 bg-surface-2 border border-app rounded-lg px-3 py-2 text-12 placeholder:text-slate-600" />
        </div>
        <button onClick={applyManual} disabled={!manualText.trim()} className="mt-2 text-11 px-3 py-1.5 rounded-full bg-amber-400 text-app disabled:opacity-40">{manualApplied ? "Ajouté" : applyLabel}</button>
      </details>
      {draft && (
        <div className="p-3 rounded-xl bg-violet-400/5 border border-violet-400/20">
          <p className="text-11 uppercase tracking-wider text-violet-300 mb-2">Proposition — modifie si besoin avant d'intégrer</p>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} className="w-full bg-surface border border-app rounded-lg px-3 py-2 text-12 mb-2" />
          <button onClick={applyDraft} className="text-11 px-3 py-1.5 rounded-full bg-amber-400 text-app">{applied ? "Intégré" : applyLabel}</button>
        </div>
      )}
    </div>
  );
}
const REQUIREMENT_SCOPES = [
  { id: "a_classer", label: "À classer", hint: "Pas encore décidé — n'est appliqué à aucun projet tant que ce n'est pas précisé." },
  { id: "universel", label: "Universelle", hint: "S'applique à tous les futurs projets, sans filtre." },
  { id: "categorie", label: "Catégorie de projet", hint: "S'applique à tous les projets de la même catégorie (Entreprise/App)." },
  { id: "famille", label: "Famille fonctionnelle", hint: "S'applique aux projets dont le profil correspond aux mots-clés ci-dessous." },
  { id: "secteur", label: "Secteur métier", hint: "S'applique aux projets du même secteur sensible (santé, finance...)." },
  { id: "specifique", label: "Projet spécifique", hint: "Ne s'applique qu'à ce projet précis." },
];
// La portée décide si une exigence s'applique à TOUS les futurs projets
// (universelle) ou seulement à ceux qui ressemblent au métier/style visé
// (cible + déclencheurs). C'est la décision la plus lourde de conséquence de
// tout Optimisation — elle ne doit jamais passer sans confirmation humaine
// explicite, même si l'IA a déjà une suggestion.
function FormalizationScopeEditor({ proposal, onConfirm, onCancel }) {
  const [scope, setScope] = useState(REQUIREMENT_SCOPES.some((s) => s.id === proposal.porteeSuggeree) ? proposal.porteeSuggeree : "specifique");
  const [cible, setCible] = useState(proposal.cibleSuggeree || "");
  const [declencheurs, setDeclencheurs] = useState((proposal.declencheurs || []).join(", "));
  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-panel border border-app rounded-2xl p-4 w-full max-w-sm max-h-85vh overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <p className="text-13 text-cream font-medium mb-1">{proposal.label}</p>
        <p className="text-11 text-slate-500 mb-3">{proposal.synthese}</p>
        <p className="text-11 uppercase tracking-wider text-slate-500 mb-2">Portée — confirme, ne reprends pas la suggestion IA sans regarder</p>
        <div className="space-y-1.5 mb-4">
          {REQUIREMENT_SCOPES.map((s) => (
            <button key={s.id} onClick={() => setScope(s.id)} className={`w-full text-left px-3 py-2 rounded-xl border text-13 ${scope === s.id ? "bg-amber-400/10 border-amber-400/40 text-amber-200" : "border-app text-slate-400"}`}>
              {s.label}{proposal.porteeSuggeree === s.id && <span className="text-9 ml-1.5 text-amber-300/70">(suggéré par l'IA)</span>}
              <span className="block text-10 text-slate-500 mt-0.5">{s.hint}</span>
            </button>
          ))}
        </div>
        {scope !== "universel" && scope !== "specifique" && (<>
          <p className="text-11 uppercase tracking-wider text-slate-500 mb-1">Cible (le métier ou style visé)</p>
          <input value={cible} onChange={(e) => setCible(e.target.value)} placeholder='Ex : "food truck", "application bien-être"' className="w-full bg-surface-2 border border-app rounded-lg px-3 py-2 text-13 mb-3 placeholder:text-slate-600" />
          <p className="text-11 uppercase tracking-wider text-slate-500 mb-1">Mots-clés déclencheurs (séparés par des virgules)</p>
          <textarea value={declencheurs} onChange={(e) => setDeclencheurs(e.target.value)} rows={2} className="w-full bg-surface-2 border border-app rounded-lg px-3 py-2 text-12 mb-3" />
        </>)}
        {scope === "universel" && <p className="text-11 text-amber-300/80 mb-3">⚠️ S'appliquera à tous les projets futurs, sans exception (sauf exclusion manuelle projet par projet).</p>}
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="text-13 text-slate-500 px-3 py-1.5">Annuler</button>
          <button onClick={() => onConfirm({ ...proposal, porteeSuggeree: scope, cibleSuggeree: cible, declencheurs: declencheurs.split(",").map((w) => w.trim()).filter(Boolean) })} className="text-13 bg-amber-400 text-app px-4 py-1.5 rounded-lg">Confirmer et valider vers le Socle</button>
        </div>
      </div>
    </div>
  );
}
function FormalizationView({ observations, onAnalyze, onAccept }) {
  const [proposals, setProposals] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [scopingProposal, setScopingProposal] = useState(null);
  async function analyze() {
    setAnalyzing(true); setError(null);
    try { setProposals(await onAnalyze()); } catch (e) { setError(e.message); }
    setAnalyzing(false);
  }
  return <div>
    <div className="p-4 rounded-xl bg-surface border border-app mb-5"><div className="flex items-start justify-between gap-3"><div><p className="text-13 text-cream font-medium">Synthèse intelligente des observations</p><p className="text-10 text-slate-600 mt-1">L'IA regroupe les doublons, trie les mécanismes, explique leurs limites et propose une exigence. Rien n'entre dans le Socle sans validation.</p></div><button onClick={analyze} disabled={analyzing || observations.length === 0} className="shrink-0 text-11 px-3 py-1.5 rounded-full bg-amber-400 text-app disabled:opacity-40 flex items-center gap-1.5">{analyzing ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}{analyzing ? "Analyse…" : "Analyser et synthétiser"}</button></div><p className="text-10 text-slate-500 mt-3">{observations.length} observation(s) disponible(s) pour l'analyse.</p>{error && <p className="text-11 text-red-300 mt-2">Analyse impossible : {error}</p>}</div>
    {proposals.length === 0 && !analyzing && <div className="p-6 rounded-xl border border-dashed border-app text-center"><p className="text-sm text-slate-400">Aucune synthèse en attente.</p><p className="text-11 text-slate-600 mt-1">Lance l'analyse après avoir accumulé plusieurs observations dans l'étape Observer.</p></div>}
    {proposals.length > 0 && <div className="space-y-3"><p className="text-11 uppercase tracking-wider text-violet-300">Synthèses proposées</p>{proposals.map((p, i) => <div key={i} className="p-4 rounded-xl bg-violet-400/5 border border-violet-400/20"><p className="text-13 text-cream font-medium">{p.label}</p><p className="text-12 text-slate-300 mt-2">{p.synthese}</p><p className="text-10 text-slate-500 mt-2">Portée suggérée : {p.porteeSuggeree} · {p.cibleSuggeree || "cible à préciser"} · {p.niveauConfiance}</p><p className="text-10 text-slate-600 mt-1">Pourquoi : {p.justification}</p><div className="flex gap-2 mt-3"><button onClick={() => setScopingProposal(p)} className="text-11 px-3 py-1.5 rounded-full bg-amber-400 text-app">Vérifier la portée et valider</button><button onClick={() => setProposals(proposals.filter((_, idx) => idx !== i))} className="text-11 px-3 py-1.5 rounded-full border border-app text-slate-500">Rejeter</button></div></div>)}</div>}
    {scopingProposal && <FormalizationScopeEditor proposal={scopingProposal} onCancel={() => setScopingProposal(null)} onConfirm={(finalProposal) => { onAccept(finalProposal); setProposals(proposals.filter((p) => p !== scopingProposal)); setScopingProposal(null); }} />}
  </div>;
}

function EngineRequirementsView({ requirements, observations, onImport, onRemove, onUpdate, promptAddendum }) {
  const [raw, setRaw] = useState("");
  const [result, setResult] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [engineExport, setEngineExport] = useState(null);
  const [copiedEngine, setCopiedEngine] = useState(false);
  const [copyError, setCopyError] = useState(false);

  function prepareExport() {
    setEngineExport(JSON.stringify({ format: "nandem-engine", version: 2, exportedAt: new Date().toISOString(), universalQualityCharter: UNIVERSAL_QUALITY_CHARTER, universalBuildWorkflow: UNIVERSAL_BUILD_WORKFLOW, defaultRelevanceChecks: DEFAULT_RELEVANCE_CHECKS, universalRules: promptAddendum || "", requirements, observations: observations || [], methodConstraintLibrary: METHOD_CONSTRAINT_LIBRARY, sectorDetectors: SECTOR_KEYWORDS, sectorExtraGoals: SECTOR_EXTRA_GOALS }, null, 2));
  }
  async function copyEngine() { if (!engineExport) return; setCopyError(false); try { let copied = false; if (navigator.clipboard && window.isSecureContext) { try { await navigator.clipboard.writeText(engineExport); copied = true; } catch {} } if (!copied) { const area = document.createElement("textarea"); area.value = engineExport; area.style.position = "fixed"; area.style.opacity = "0"; document.body.appendChild(area); area.select(); copied = document.execCommand("copy"); document.body.removeChild(area); } if (!copied) throw new Error("copy"); setCopiedEngine(true); setTimeout(() => setCopiedEngine(false), 1500); } catch { setCopyError(true); } }
  function downloadEngine() { if (!engineExport) return; const url = URL.createObjectURL(new Blob([engineExport], { type: "application/json" })); const a = document.createElement("a"); a.href = url; a.download = `nandem-moteur-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(url); }

  function runImport() {
    try {
      const report = onImport(raw);
      setResult({ ok: true, ...report });
      setRaw("");
    } catch (e) {
      setResult({ ok: false, error: e.message });
    }
  }

  const universalCount = requirements.filter((r) => requirementScopeId(r) === "universel").length;
  const toClassifyCount = requirements.filter((r) => requirementScopeId(r) === "a_classer").length;
  // Onglets par statut (27/08/2026) — la liste plate de toutes les exigences
  // devient illisible en grandissant ("imagine après 2000 projets") : on la
  // découpe selon les 4 statuts déjà définis (NIVEAUX_PREUVE) plutôt que
  // d'introduire une nouvelle classification.
  const [statutTab, setStatutTab] = useState(NIVEAUX_PREUVE[0]);
  const visibleRequirements = requirements.filter((r) => (r.statut || "Inconnu") === statutTab);
  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-11 uppercase tracking-wider text-slate-500">Bibliothèque d'exigences</p>
          <p className="text-10 text-slate-600 mt-1">Règles structurées que le moteur pourra sélectionner selon chaque projet. Un import n'est jamais injecté automatiquement sans avoir été validé ici.</p>
        </div>
        <button onClick={() => setShowImport((v) => !v)} className="shrink-0 flex items-center gap-1.5 text-12 px-3 py-1.5 rounded-full bg-amber-400 text-app"><Download size={12} /> Importer JSON</button>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-5">
        <div className="p-3 rounded-xl bg-surface border border-app text-center"><p className="text-lg font-display text-amber-400">{requirements.length}</p><p className="text-10 text-slate-500">Total</p></div>
        <div className="p-3 rounded-xl bg-surface border border-app text-center"><p className="text-lg font-display text-amber-400">{universalCount}</p><p className="text-10 text-slate-500">Universelles</p></div>
        <div className="p-3 rounded-xl bg-surface border border-app text-center"><p className="text-lg font-display text-amber-400">{toClassifyCount}</p><p className="text-10 text-slate-500">À classer</p></div>
      </div>
      {showImport && (
        <div className="mb-5 p-4 rounded-xl bg-surface border border-app">
          <p className="text-11 text-slate-400 mb-2">Colle un export moteur complet, un objet <span className="font-mono-data">{"{ requirements: [...] }"}</span> ou un ancien format <span className="font-mono-data">{"{ patterns: [...] }"}</span>. Les identifiants existants sont mis à jour.</p>
          <textarea value={raw} onChange={(e) => setRaw(e.target.value)} rows={10} placeholder='{"format":"nandem-pattern-library","version":1,"patterns":[...]}' className="w-full bg-surface-2 border border-app rounded-xl px-3 py-2 text-11 font-mono-data placeholder:text-slate-600" />
          {result && (result.ok
            ? <p className="text-11 text-amber-300 mt-2">{result.added} ajoutée(s), {result.updated} mise(s) à jour, {result.rejected} rejetée(s).</p>
            : <p className="text-11 text-red-300 mt-2">Import refusé : {result.error}</p>)}
          <div className="flex justify-end gap-2 mt-3"><button onClick={() => setShowImport(false)} className="text-12 text-slate-500 px-3 py-1.5">Fermer</button><button onClick={runImport} disabled={!raw.trim()} className="text-12 bg-amber-400 text-app px-3 py-1.5 rounded-lg disabled:opacity-40">Analyser et importer</button></div>
        </div>
      )}
      <div className="mb-5 p-4 rounded-xl bg-surface border border-app"><div className="flex items-center justify-between gap-3"><div><p className="text-12 text-cream font-medium">Sortir le moteur de NANDĒM</p><p className="text-10 text-slate-600 mt-1">Exporte la charte, le workflow, les observations, détecteurs, exigences et règles accumulées dans un format réimportable.</p></div><button onClick={prepareExport} className="text-11 px-3 py-1.5 rounded-full border border-amber-400/30 text-amber-300">Préparer l'export</button></div>{engineExport && <><textarea readOnly value={engineExport} onFocus={(e) => e.target.select()} rows={7} className="w-full mt-3 bg-surface-2 border border-app rounded-lg px-3 py-2 text-10 font-mono-data text-slate-400" /><div className="flex gap-2 mt-2"><button onClick={copyEngine} className="text-11 px-3 py-1.5 rounded-full bg-amber-400 text-app">{copiedEngine ? "Copié" : "Copier tout"}</button><button onClick={downloadEngine} className="text-11 px-3 py-1.5 rounded-full border border-app text-slate-400">Télécharger JSON</button></div>{copyError && <p className="text-10 text-red-300 mt-2">Copie automatique refusée : sélectionne le JSON ci-dessus puis copie-le manuellement.</p>}</>}</div>
      {requirements.length === 0 ? (
        <div className="p-6 rounded-xl border border-dashed border-app text-center"><p className="text-sm text-slate-400">Aucune exigence importée.</p><p className="text-11 text-slate-600 mt-1">Les patterns détectés restent dans l'onglet Patterns ; les règles prêtes pour le moteur vivront ici.</p></div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            {NIVEAUX_PREUVE.map((niveau) => {
              const count = requirements.filter((r) => (r.statut || "Inconnu") === niveau).length;
              return <button key={niveau} onClick={() => setStatutTab(niveau)} className={`p-2 rounded-lg text-12 border transition-colors ${statutTab === niveau ? "bg-amber-400 text-app border-amber-400" : "border-app text-slate-400"}`}>{niveau} <span className="opacity-70">({count})</span></button>;
            })}
          </div>
          {visibleRequirements.length === 0 && <p className="text-12 text-slate-600 mb-3">Aucune exigence au statut « {statutTab} » pour l'instant.</p>}
          <div className="space-y-3">{visibleRequirements.map((r) => (
          <div key={r.id} className="p-4 rounded-xl bg-surface border border-app">
            <div className="flex items-start justify-between gap-3"><div><p className="text-13 text-cream font-medium">{r.label}</p><div className="flex gap-1.5 mt-1.5 flex-wrap"><span className="text-10 px-2 py-0.5 rounded-full border border-amber-400/30 text-amber-300">{REQUIREMENT_SCOPES.find((s) => s.id === requirementScopeId(r))?.label || "À classer"}</span><span className="text-10 px-2 py-0.5 rounded-full border border-app text-slate-400">{r.statut}</span><span className="text-10 px-2 py-0.5 rounded-full border border-app text-slate-500">Priorité {r.priorite}</span>{r.lockedDefault && <span className="text-10 px-2 py-0.5 rounded-full border border-violet-400/30 text-violet-300">Socle initial · 200 tests</span>}</div></div>{!r.lockedDefault && <button onClick={() => onRemove(r.id)} title="Retirer cette exigence" className="text-slate-600 hover:text-red-300"><Trash2 size={14} /></button>}</div>
            <p className="text-12 text-slate-300 leading-relaxed mt-3">{r.instruction}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3"><label className="text-10 text-slate-500">Niveau d'universalité<select value={requirementScopeId(r)} onChange={(e) => onUpdate(r.id, { portee: { niveau: e.target.value, cible: typeof r.portee === "object" ? (r.portee.cible || "") : "" } })} className="block w-full mt-1 bg-surface-2 border border-app rounded-lg px-2.5 py-1.5 text-11 text-slate-300">{REQUIREMENT_SCOPES.map((scope) => <option key={scope.id} value={scope.id}>{scope.label}</option>)}</select></label><label className="text-10 text-slate-500">Cible précise<input value={typeof r.portee === "object" ? (r.portee.cible || "") : ""} onChange={(e) => onUpdate(r.id, { portee: { niveau: requirementScopeId(r), cible: e.target.value } })} placeholder="Ex : réseau social, réservation, santé…" className="block w-full mt-1 bg-surface-2 border border-app rounded-lg px-2.5 py-1.5 text-11 text-slate-300 placeholder:text-slate-600" /></label></div>
            {r.declencheurs.length > 0 && <p className="text-10 text-slate-600 mt-2">Déclencheurs : {r.declencheurs.join(" · ")}</p>}
            <p className="text-10 text-slate-600 mt-1">Preuves : {r.preuves.projetsReels} réel(s) · {r.preuves.projetsFictifs} fictif(s) · {r.preuves.bugsConfirmes} bug(s) · {r.preuves.contreExemples} contre-exemple(s)</p>{r.provenance?.statut && <p className="text-9 text-violet-300/70 mt-1">Provenance : {r.provenance.statut}</p>}
          </div>
        ))}</div>
        </>
      )}
    </div>
  );
}

function QuestionnaireOptimizationPanel({ diagnosedCount, overrides, onAnalyze, onAccept, onRevert }) {
  const [proposals, setProposals] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [message, setMessage] = useState(null);
  async function analyze() {
    setAnalyzing(true); setMessage(null);
    try {
      const result = await onAnalyze();
      setProposals(result.proposals || []);
      setMessage(result.message || (!result.proposals?.length ? "Aucune amélioration suffisamment soutenue n’a été détectée." : null));
    } catch (error) { setMessage(`Analyse impossible : ${error.message}`); }
    setAnalyzing(false);
  }
  return <div className="mt-6 border-t border-app pt-6">
    <div className="p-4 rounded-xl bg-surface border border-app">
      <div className="flex items-start justify-between gap-3"><div><p className="text-13 text-cream font-medium">Optimiser le questionnaire Discovery</p><p className="text-10 text-slate-600 mt-1">Le Discovery reste sans IA pendant son utilisation. Ici seulement, tu peux lancer une revue différée des diagnostics terminés — réponses finales ET conversation brute (pour repérer les questions qui déclenchent souvent une relance). Les noms de projets ne sont pas envoyés, et les emails, téléphones et liens évidents sont masqués partout, y compris dans la conversation. Aucune question n’est modifiée sans validation.</p></div><button onClick={analyze} disabled={analyzing || diagnosedCount < 2} className="shrink-0 text-11 px-3 py-1.5 rounded-full bg-amber-400 text-app disabled:opacity-40 flex items-center gap-1.5">{analyzing ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}{analyzing ? "Analyse…" : "Analyser les questionnaires"}</button></div>
      <p className="text-10 text-slate-500 mt-3">{diagnosedCount} questionnaire(s) terminé(s). Minimum conseillé : 2 ; une proposition reste une hypothèse tant que plusieurs usages ne la confirment pas.</p>
      {message && <p className="text-11 text-amber-300 mt-2">{message}</p>}
    </div>
    {proposals.length > 0 && <div className="space-y-3 mt-4"><p className="text-11 uppercase tracking-wider text-violet-300">Améliorations proposées — validation obligatoire</p>{proposals.map((proposal, index) => <div key={`${proposal.questionnaire}:${proposal.goalId}:${index}`} className="p-4 rounded-xl bg-violet-400/5 border border-violet-400/20"><div className="flex gap-2 flex-wrap"><span className="text-10 px-2 py-0.5 rounded-full border border-violet-400/30 text-violet-300">{proposal.questionnaire === "app" ? "Application" : "Entreprise"}</span><span className="text-10 text-slate-500">{proposal.niveauConfiance}</span></div><p className="text-13 text-cream font-medium mt-2">{proposal.label}</p><p className="text-11 text-slate-400 mt-1">Problème observé : {proposal.probleme}</p>{proposal.preuves.length > 0 && <ul className="mt-2 space-y-1">{proposal.preuves.map((proof, i) => <li key={i} className="text-10 text-slate-500">• {proof}</li>)}</ul>}<div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3"><div className="p-3 rounded-lg bg-surface border border-app"><p className="text-9 uppercase text-slate-600">Question actuelle</p><p className="text-11 text-slate-400 mt-1">{proposal.questionActuelle}</p></div><div className="p-3 rounded-lg bg-amber-400/5 border border-amber-400/20"><p className="text-9 uppercase text-amber-400/70">Question proposée</p><p className="text-11 text-slate-200 mt-1">{proposal.questionProposee}</p></div></div><p className="text-10 text-slate-500 mt-2">Bénéfice attendu : {proposal.beneficeAttendu}</p><div className="flex gap-2 mt-3"><button onClick={() => { onAccept(proposal); setProposals(proposals.filter((_, i) => i !== index)); }} className="text-11 px-3 py-1.5 rounded-full bg-amber-400 text-app">Valider cette nouvelle version</button><button onClick={() => setProposals(proposals.filter((_, i) => i !== index))} className="text-11 px-3 py-1.5 rounded-full border border-app text-slate-500">Rejeter</button></div></div>)}</div>}
    {overrides.length > 0 && <div className="mt-5"><p className="text-11 uppercase tracking-wider text-slate-500 mb-2">Questions améliorées et actives</p><div className="space-y-2">{overrides.map((override) => <div key={`${override.questionnaire}:${override.goalId}`} className="p-3 rounded-xl bg-surface border border-app"><div className="flex items-start justify-between gap-3"><div><p className="text-12 text-cream">{override.label} <span className="text-9 text-slate-600">v{override.version} · {override.questionnaire === "app" ? "Application" : "Entreprise"}</span></p><p className="text-11 text-slate-400 mt-1">{override.question}</p><p className="text-9 text-slate-600 mt-1">Validée le {new Date(override.updatedAt).toLocaleDateString("fr-FR")}</p></div><button onClick={() => onRevert(override.goalId, override.questionnaire)} className="text-10 px-2 py-1 rounded-full border border-app text-slate-500">Revenir à l’origine</button></div></div>)}</div></div>}
  </div>;
}

function PromptEngineeringWorkspace({ diagnosedCount, overrides, onAnalyzeQuestionnaires, onAcceptQuestionImprovement, onRevertQuestionImprovement, promptAddendum, onPromoteSynthesized }) {
  const [area, setArea] = useState("engineering");
  const [promptText, setPromptText] = useState("");
  const [audit, setAudit] = useState(null);
  const [comparisonText, setComparisonText] = useState("");
  const [comparison, setComparison] = useState(null);
  const [referencePrompt, setReferencePrompt] = useState("");
  const [generatedResult, setGeneratedResult] = useState("");
  const [verification, setVerification] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState(null);
  // Vérification manuelle (27/08/2026) — cette zone avait déjà les deux
  // textarea (dossier de référence / résultat à vérifier) mais forçait
  // l'appel à l'IA intégrée pour obtenir un rapport. Ajout du même chemin
  // copier/coller que dans Réalisation, en réutilisant directement
  // buildVerificationPrompt/parseVerificationResponse (pas de duplication).
  const [manualVerifyOpen, setManualVerifyOpen] = useState(false);
  const [manualVerifyText, setManualVerifyText] = useState("");
  const [manualVerifyError, setManualVerifyError] = useState(null);
  const [manualVerifyCopied, setManualVerifyCopied] = useState(false);
  const [reportPromptCopied, setReportPromptCopied] = useState(false);
  const AREAS = [{ id: "questionnaire", label: "Questionnaire" }, { id: "engineering", label: "Prompt Engineering" }, { id: "verification", label: "Vérification des résultats" }];
  async function copyReportPrompt() {
    try { await navigator.clipboard.writeText(buildReportRequestPrompt()); setReportPromptCopied(true); setTimeout(() => setReportPromptCopied(false), 1800); } catch {}
  }
  async function copyManualVerifyPrompt() {
    if (!referencePrompt.trim() || !generatedResult.trim()) return;
    const prompt = buildVerificationPrompt(referencePrompt, generatedResult);
    try { await navigator.clipboard.writeText(prompt); setManualVerifyCopied(true); setTimeout(() => setManualVerifyCopied(false), 1800); }
    catch { setManualVerifyError("Copie automatique indisponible : sélectionne la demande affichée."); }
  }
  function importManualVerification() {
    try {
      const report = parseVerificationResponse(extractJSON(manualVerifyText));
      setVerification(report); setVerificationError(null);
      setManualVerifyText(""); setManualVerifyError(null); setManualVerifyOpen(false);
    } catch (error) { setManualVerifyError(`Réponse non importée : ${error.message}`); }
  }
  async function runVerification() {
    setVerifying(true); setVerificationError(null); setVerification(null);
    try {
      const report = await verifyGeneratedResult(referencePrompt, generatedResult);
      setVerification(report);
      const record = { id: genId(), date: new Date().toISOString(), score: report.score, verdict: report.verdict, ecarts: report.ecarts.length };
      try { const stored = await window.storage.get("nandem-verification-history"); const history = stored ? JSON.parse(stored.value) : []; await window.storage.set("nandem-verification-history", JSON.stringify([record, ...history].slice(0, 50))); } catch {}
    } catch (error) { setVerificationError(error.message); }
    setVerifying(false);
  }
  return <div>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-5">{AREAS.map((item) => <button key={item.id} onClick={() => setArea(item.id)} className={`p-3 rounded-xl border text-12 text-left ${area === item.id ? "bg-violet-400/10 border-violet-400/30 text-violet-200" : "bg-surface border-app text-slate-500"}`}>{item.label}</button>)}</div>
    {area === "questionnaire" && <QuestionnaireOptimizationPanel diagnosedCount={diagnosedCount} overrides={overrides} onAnalyze={onAnalyzeQuestionnaires} onAccept={onAcceptQuestionImprovement} onRevert={onRevertQuestionImprovement} />}
    {area === "engineering" && <div>
      <div className="p-4 rounded-xl bg-surface border border-app mb-5"><p className="text-13 text-cream font-medium">Audit du prompt — sans appel IA</p><p className="text-10 text-slate-600 mt-1 mb-3">Colle n’importe quel prompt ou dossier de construction. NANDĒM vérifie sa structure, sa testabilité, son périmètre et son indépendance technologique sans coût d’API.</p><textarea value={promptText} onChange={(event) => { setPromptText(event.target.value); setAudit(null); }} rows={9} placeholder="Colle ici le prompt à auditer…" className="w-full bg-surface-2 border border-app rounded-xl px-3 py-2 text-11 font-mono-data placeholder:text-slate-600" /><button onClick={() => setAudit(auditPromptEngineering(promptText))} disabled={!promptText.trim()} className="mt-2 text-11 px-3 py-1.5 rounded-full bg-amber-400 text-app disabled:opacity-40">Auditer sans IA</button></div>
      {audit && <div className="p-4 rounded-xl bg-surface border border-app mb-5"><div className="flex items-end gap-3"><p className="text-3xl font-display text-amber-400">{audit.score}/100</p><p className="text-12 text-slate-400 mb-1">{audit.status} · {audit.words} mots</p></div><div className="space-y-2 mt-4">{audit.checks.map((check) => <div key={check.id} className="flex gap-2 items-start"><span className={`mt-0.5 ${check.ok ? "text-emerald-300" : "text-red-300"}`}>{check.ok ? "✓" : "×"}</span><div><p className="text-11 text-slate-300">{check.label}</p>{!check.ok && <p className="text-10 text-slate-600">{check.advice}</p>}</div></div>)}</div>{audit.ambiguities.length > 0 && <p className="text-10 text-amber-300 mt-3">Ambiguïtés encore présentes : {audit.ambiguities.join(" · ")}</p>}</div>}
      <div className="p-4 rounded-xl bg-surface border border-app mb-5"><p className="text-13 text-cream font-medium">Comparer un vrai projet aux 200 simulations</p><p className="text-10 text-slate-600 mt-1 mb-3">Colle la demande reçue, un email, un brief ou un JSON. La comparaison est locale et sans IA : elle cherche des signaux, affiche la fréquence observée dans les 200 projets fictifs et laisse chaque conclusion à confirmer.</p><textarea value={comparisonText} onChange={(event) => { setComparisonText(event.target.value); setComparison(null); }} rows={8} placeholder="Colle ici la demande réelle à comparer…" className="w-full bg-surface-2 border border-app rounded-xl px-3 py-2 text-11 placeholder:text-slate-600" /><button onClick={() => setComparison(compareProjectWithSimulation(comparisonText))} disabled={!comparisonText.trim()} className="mt-2 text-11 px-3 py-1.5 rounded-full bg-amber-400 text-app disabled:opacity-40">Comparer aux 200 tests</button></div>
      {comparison && <div className="p-4 rounded-xl bg-surface border border-app mb-5"><div className="flex items-center justify-between gap-3"><div><p className="text-13 text-cream font-medium">Résultat de comparaison</p><p className="text-10 text-slate-600 mt-1">{comparison.filter((item) => item.applicable).length} correspondance(s) détectée(s) sur {comparison.length} contrôles. Une absence de mot-clé ne prouve jamais qu’un besoin est absent.</p></div><span className="text-xl font-display text-amber-400">{comparison.filter((item) => item.applicable).length}/{comparison.length}</span></div><div className="space-y-2 mt-4">{comparison.map((item) => <div key={item.id} className={`p-3 rounded-xl border ${item.applicable ? "bg-violet-400/5 border-violet-400/20" : "bg-surface-2 border-app"}`}><div className="flex items-start justify-between gap-3"><div><p className="text-11 text-slate-200">{item.applicable ? "✓" : "○"} {item.label}</p><p className="text-10 text-slate-600 mt-1">Fréquence fictive : {Math.round(item.frequency * 100)} % · {item.confidence}</p></div>{item.matches.length > 0 && <span className="text-9 text-violet-300">{item.matches.join(" · ")}</span>}</div>{item.applicable && <p className="text-10 text-slate-500 mt-2">Question à confirmer : {item.question}</p>}</div>)}</div></div>}
      <PromptChatPanel title="Améliorer les règles universelles avec l’IA" description="Après l’audit sans coût, utilise cette discussion seulement si une règle mérite une analyse ou une reformulation plus profonde. Rien n’est intégré sans validation." placeholder="Ex : rends les critères d’acceptation plus vérifiables…" applyLabel="Intégrer dans les règles universelles" contextText={promptAddendum} chatFn={chatAboutPrompt} onApply={onPromoteSynthesized} />
    </div>}
    {area === "verification" && <div>
      <div className="p-4 rounded-xl bg-surface border border-app"><p className="text-13 text-cream font-medium">Vérifier ce qu’une IA ou une technologie a produit</p><p className="text-10 text-slate-600 mt-1 mb-3">Colle le dossier envoyé puis la réponse, le rapport ou le code produit. Cette action utilise l’IA configurée dans NANDĒM et génère un rapport d’écarts ; elle ne modifie aucun projet automatiquement.</p><label className="text-10 text-slate-500">Dossier de référence<textarea value={referencePrompt} onChange={(event) => setReferencePrompt(event.target.value)} rows={7} placeholder="Prompt ou dossier de construction envoyé…" className="block w-full mt-1 mb-3 bg-surface-2 border border-app rounded-xl px-3 py-2 text-11 font-mono-data placeholder:text-slate-600" /></label><div className="flex items-center justify-between mb-1"><label className="text-10 text-slate-500">Résultat à vérifier</label><button onClick={copyReportPrompt} className="text-9 px-2 py-1 rounded-full border border-amber-400/30 text-amber-300 shrink-0">{reportPromptCopied ? "Demande copiée ✓" : "Copier une demande de compte-rendu à l'IA"}</button></div><textarea value={generatedResult} onChange={(event) => setGeneratedResult(event.target.value)} rows={9} placeholder="Réponse, compte rendu, code ou liste des fonctionnalités produites…" className="block w-full bg-surface-2 border border-app rounded-xl px-3 py-2 text-11 font-mono-data placeholder:text-slate-600" /><button onClick={runVerification} disabled={verifying || !referencePrompt.trim() || !generatedResult.trim()} className="mt-3 text-11 px-3 py-1.5 rounded-full bg-amber-400 text-app disabled:opacity-40 flex items-center gap-1.5">{verifying && <Loader2 size={12} className="animate-spin" />}{verifying ? "Vérification…" : "Vérifier la conformité"}</button>{verificationError && <p className="text-11 text-red-300 mt-2">Vérification impossible : {verificationError}</p>}
        <div className="mt-3 pt-3 border-t border-app-soft">
          <button onClick={() => setManualVerifyOpen(!manualVerifyOpen)} disabled={!referencePrompt.trim() || !generatedResult.trim()} className="text-10 text-amber-300/80 disabled:opacity-40">{manualVerifyOpen ? "Masquer la vérification manuelle" : "Pas de crédit API ? Vérifier manuellement →"}</button>
          {manualVerifyOpen && (
            <div className="mt-3">
              <button onClick={copyManualVerifyPrompt} className="text-10 px-3 py-1.5 rounded-full bg-amber-400 text-app">{manualVerifyCopied ? "Demande copiée ✓" : "1. Copier la demande de vérification"}</button>
              <textarea readOnly value={buildVerificationPrompt(referencePrompt, generatedResult)} onFocus={(event) => event.target.select()} rows={5} className="w-full mt-3 bg-surface-2 border border-app rounded-lg px-3 py-2 text-10 font-mono-data text-slate-500" />
              <textarea value={manualVerifyText} onChange={(event) => setManualVerifyText(event.target.value)} rows={6} placeholder="2. Colle ici la réponse JSON obtenue…" className="w-full mt-3 bg-surface-2 border border-app rounded-lg px-3 py-2 text-11 font-mono-data placeholder:text-slate-600" />
              <button onClick={importManualVerification} disabled={!manualVerifyText.trim()} className="mt-2 text-10 px-3 py-1.5 rounded-full bg-emerald-400 text-app disabled:opacity-40">3. Vérifier et enregistrer</button>
              {manualVerifyError && <p className="text-10 text-red-300 mt-2">{manualVerifyError}</p>}
            </div>
          )}
        </div>
      </div>
      {verification && <div className="p-4 rounded-xl bg-surface border border-app mt-4"><div className="flex items-end gap-3"><p className="text-3xl font-display text-amber-400">{verification.score}/100</p><p className="text-12 text-slate-400 mb-1">{verification.verdict}</p></div>{verification.conformites.length > 0 && <div className="mt-4"><p className="text-10 uppercase text-emerald-300 mb-1">Conforme</p>{verification.conformites.map((item, index) => <p key={index} className="text-11 text-slate-400">✓ {item}</p>)}</div>}{verification.ecarts.length > 0 && <div className="mt-4 space-y-2"><p className="text-10 uppercase text-red-300">Écarts</p>{verification.ecarts.map((item, index) => <div key={index} className="p-3 rounded-lg bg-red-400/5 border border-red-400/20"><p className="text-11 text-red-200">[{item.gravite || "important"}] {item.exigence}</p><p className="text-10 text-slate-400 mt-1">{item.constat}</p><p className="text-10 text-amber-300 mt-1">Correction : {item.correction}</p></div>)}</div>}{verification.testsAExecuter.length > 0 && <div className="mt-4"><p className="text-10 uppercase text-slate-500 mb-1">Tests à exécuter</p>{verification.testsAExecuter.map((item, index) => <p key={index} className="text-11 text-slate-400">□ {item}</p>)}</div>}{verification.instructionCorrective && <div className="mt-4 p-3 rounded-xl bg-amber-400/5 border border-amber-400/20"><p className="text-10 uppercase text-amber-300 mb-1">Instruction corrective prête à renvoyer</p><p className="text-11 text-slate-300 whitespace-pre-line">{verification.instructionCorrective}</p></div>}</div>}
    </div>}
  </div>;
}

function EngineConfidenceView({ requirements, observations, index, questionOverrides, promptFeedback }) {
  const [cycleStats, setCycleStats] = useState({ loading: true, cycles: 0, compared: 0, positive: 0, negative: 0, unchanged: 0, deltas: [] });
  useEffect(() => { (async () => {
    const stats = { loading: false, cycles: 0, compared: 0, positive: 0, negative: 0, unchanged: 0, deltas: [] };
    for (const item of index.slice(0, 100)) {
      try {
        const stored = await window.storage.get(`nandem-project:${item.id}`); if (!stored) continue;
        const project = JSON.parse(stored.value);
        for (const cycle of project.realizations || []) {
          stats.cycles += 1;
          const before = Number(cycle.initialVerification?.score); const after = Number(cycle.finalVerification?.score);
          if (Number.isFinite(before) && Number.isFinite(after)) {
            const delta = after - before; stats.compared += 1; stats.deltas.push(delta);
            if (delta > 0) stats.positive += 1; else if (delta < 0) stats.negative += 1; else stats.unchanged += 1;
          }
        }
      } catch {}
    }
    setCycleStats(stats);
  })(); }, [index]);
  const total = requirements.length;
  const withRealEvidence = requirements.filter((r) => Number(r.preuves?.projetsReels) > 0 || Number(r.preuves?.bugsConfirmes) > 0).length;
  const established = requirements.filter((r) => r.statut === "Établi").length;
  const establishedWithReal = requirements.filter((r) => r.statut === "Établi" && (Number(r.preuves?.projetsReels) > 0 || Number(r.preuves?.bugsConfirmes) > 0)).length;
  const syntheticOnly = requirements.filter((r) => Number(r.preuves?.projetsFictifs) > 0 && Number(r.preuves?.projetsReels) === 0 && Number(r.preuves?.bugsConfirmes) === 0).length;
  const importedHypotheses = requirements.filter((r) => r.statut === "Hypothèse" && r.provenance?.type === "apport-porteur").length;
  const counterExamples = requirements.reduce((sum, r) => sum + (Number(r.preuves?.contreExemples) || 0), 0);
  const pendingObservations = observations.filter((o) => !["Établi", "Rejeté"].includes(o.statut)).length;
  const promotedFeedback = promptFeedback.filter((f) => f.promoted).length;
  const avgDelta = cycleStats.deltas.length ? cycleStats.deltas.reduce((a, b) => a + b, 0) / cycleStats.deltas.length : null;
  const evidencePart = total ? 40 * withRealEvidence / total : 0;
  const validationPart = total ? 25 * establishedWithReal / total : 0;
  const cyclePart = 20 * Math.min(1, cycleStats.compared / 10);
  const regressionPart = cycleStats.compared ? 15 * (1 - cycleStats.negative / cycleStats.compared) : 0;
  const maturity = Math.round(evidencePart + validationPart + cyclePart + regressionPart);
  const maturityLabel = maturity >= 75 ? "Soutenu par l’usage" : maturity >= 45 ? "En consolidation" : maturity >= 20 ? "En apprentissage" : "Démarrage expérimental";
  const ruleState = (r) => {
    const real = Number(r.preuves?.projetsReels) || 0; const bugs = Number(r.preuves?.bugsConfirmes) || 0; const fictive = Number(r.preuves?.projetsFictifs) || 0;
    if (r.statut === "Établi" && real + bugs >= 2) return ["Soutenue", "text-emerald-300"];
    if (real + bugs > 0) return ["Preuve réelle à confirmer", "text-amber-300"];
    if (fictive > 0) return ["Simulation uniquement", "text-violet-300"];
    return ["Hypothèse importée", "text-slate-500"];
  };
  return <div>
    <div className="p-4 rounded-xl bg-surface border border-app mb-4"><div className="flex items-end justify-between gap-4"><div><p className="text-13 text-cream font-medium">Indice de maturité du moteur</p><p className="text-10 text-slate-600 mt-1">Mesure de suivi interne, pas une probabilité de qualité. Le score augmente uniquement avec des preuves réelles, des validations et des cycles avant/après.</p></div><div className="text-right shrink-0"><p className="text-3xl font-display text-amber-400">{maturity}/100</p><p className="text-10 text-slate-500">{maturityLabel}</p></div></div><div className="h-2 rounded-full bg-surface-2 mt-4 overflow-hidden"><div className="h-full bg-amber-400 rounded-full" style={{ width: `${maturity}%` }} /></div></div>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
      {[ [withRealEvidence, "Règles avec preuve réelle"], [syntheticOnly, "Simulation uniquement"], [importedHypotheses, "Hypothèses importées"], [counterExamples, "Contre-exemples"] ].map(([value, label]) => <div key={label} className="p-3 rounded-xl bg-surface border border-app text-center"><p className="text-xl font-display text-amber-400">{value}</p><p className="text-9 text-slate-500 mt-1">{label}</p></div>)}
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4"><div className="p-4 rounded-xl bg-surface border border-app"><p className="text-11 uppercase text-slate-500">Validation du moteur</p><p className="text-12 text-slate-300 mt-2">{established} règle(s) marquée(s) Établi, dont {establishedWithReal} soutenue(s) par une preuve réelle.</p><p className="text-10 text-slate-600 mt-2">{pendingObservations} observation(s) attendent encore formalisation ou décision.</p></div><div className="p-4 rounded-xl bg-surface border border-app"><p className="text-11 uppercase text-slate-500">Impact observé</p><p className="text-12 text-slate-300 mt-2">{cycleStats.cycles} cycle(s) de réalisation · {cycleStats.compared} comparaison(s) avant/après.</p><p className="text-10 mt-2"><span className="text-emerald-300">{cycleStats.positive} amélioration(s)</span> · <span className="text-red-300">{cycleStats.negative} régression(s)</span> · <span className="text-slate-500">{cycleStats.unchanged} stable(s)</span></p>{avgDelta !== null && <p className="text-10 text-slate-500 mt-1">Évolution moyenne : {avgDelta > 0 ? "+" : ""}{avgDelta.toFixed(1)} points.</p>}</div></div>
    <div className="p-4 rounded-xl bg-surface border border-app mb-4"><p className="text-11 uppercase text-slate-500">Évolutions enregistrées</p><p className="text-12 text-slate-300 mt-2">{requirements.filter((r) => Number(r.version) > 1).length} exigence(s) révisée(s) · {questionOverrides.length} question(s) améliorée(s) · {promotedFeedback} amélioration(s) du prompt universel.</p></div>
    {(withRealEvidence === 0 || cycleStats.compared === 0 || syntheticOnly > 0) && <div className="p-4 rounded-xl bg-amber-400/5 border border-amber-400/20 mb-4"><p className="text-11 uppercase text-amber-300">Points de vigilance</p>{withRealEvidence === 0 && <p className="text-10 text-slate-400 mt-2">• Aucune règle ne possède encore de preuve issue d’un projet réel.</p>}{cycleStats.compared === 0 && <p className="text-10 text-slate-400 mt-1">• Aucun cycle complet avant/après ne permet encore de mesurer l’efficacité des corrections.</p>}{syntheticOnly > 0 && <p className="text-10 text-slate-400 mt-1">• {syntheticOnly} règle(s) reposent uniquement sur des simulations fictives.</p>}</div>}
    <div className="p-4 rounded-xl bg-surface border border-app"><p className="text-11 uppercase text-slate-500 mb-3">État des règles</p><div className="space-y-2 max-h-96 overflow-y-auto">{requirements.map((r) => { const [label, color] = ruleState(r); return <div key={r.id} className="p-3 rounded-lg bg-surface-2 border border-app"><div className="flex items-start justify-between gap-3"><div><p className="text-11 text-slate-300">{r.label}</p><p className="text-9 text-slate-600 mt-1">{r.portee?.niveau || r.portee} · {r.statut}</p></div><span className={`text-9 shrink-0 ${color}`}>{label}</span></div></div>; })}</div></div>
  </div>;
}

function LibraryView({ library, onRemove, onAcceptProposal, onPromote, onScanProjects, promptFeedback, promptAddendum, onPromoteFeedback, onDismissFeedback, onPromoteSynthesized, index, customGoals, questionOverrides, onAnalyzeQuestionnaires, onAcceptQuestionImprovement, onRevertQuestionImprovement, onUpdateStatut, engineRequirements, onImportRequirements, onRemoveRequirement, onUpdateRequirement, onAnalyzeFormalization, onAcceptFormalization, onAddManualObservation, onImportManualObservations }) {
  const [subTab, setSubTab] = useState("patterns");
  const [proposals, setProposals] = useState([]); const [scanning, setScanning] = useState(false); const [wasTruncated, setWasTruncated] = useState(false);
  const [promotingEntry, setPromotingEntry] = useState(null);
  const [scanMessage, setScanMessage] = useState(null);
  const [scanningFeedback, setScanningFeedback] = useState(false);
  const [feedbackProposals, setFeedbackProposals] = useState([]);
  const [feedbackScanMessage, setFeedbackScanMessage] = useState(null);
  const [manualObservationLabel, setManualObservationLabel] = useState("");
  const [manualObservationText, setManualObservationText] = useState("");
  const [manualObservationSaved, setManualObservationSaved] = useState(false);
  const [manualJsonOpen, setManualJsonOpen] = useState(false);
  const [manualJsonRaw, setManualJsonRaw] = useState("");
  const [manualJsonResult, setManualJsonResult] = useState(null);
  const eligibleProjectCount = new Set(library.map((l) => l.projectId)).size;
  const diagnosedCount = index.filter((p) => p.hasDiscovery && !p.archived).length;
  const genericCount = library.filter((l) => l.statut === "Établi").length;
  // Ajouté après un signalement réel du porteur : les patterns déjà
  // conservés dans le moteur (DEFAULT_ENGINE_REQUIREMENTS, ~60 au départ)
  // n'apparaissaient nulle part dans cet écran — donnant l'impression
  // trompeuse qu'ils avaient disparu, alors qu'ils vivent dans le Socle en
  // permanence et sont simplement sélectionnés par projet, pas listés ici.
  const enginePatternCount = engineRequirements.length;
  const promisingPatternCount = engineRequirements.filter((r) => r.statut === "Prometteur").length;
  const hypothesisPatternCount = engineRequirements.filter((r) => r.statut === "Hypothèse").length;
  const establishedPatternCount = engineRequirements.filter((r) => r.statut === "Établi").length + genericCount;
  async function scan() { setScanning(true); setScanMessage(null); const { proposals: p, truncated } = await detectPatterns(library); setProposals(p); setWasTruncated(truncated); setScanning(false); if (!p.length) setScanMessage("Aucun pattern trouvé dans la bibliothèque actuelle."); }
  async function scanProjects() {
    setScanning(true); setScanMessage(null);
    const { proposals: p, scanned, totalEligible, skippedNoSynthesis } = await onScanProjects();
    setProposals(p); setWasTruncated(false); setScanning(false);
    const skipNote = skippedNoSynthesis > 0 ? ` ⚠️ ${skippedNoSynthesis} projet${skippedNoSynthesis > 1 ? "s" : ""} ignoré${skippedNoSynthesis > 1 ? "s" : ""} (pas encore de synthèse générée).` : "";
    if (scanned < 2) setScanMessage(`Il faut au moins 2 projets avec une synthèse pour chercher une récurrence (${scanned} disponible${scanned > 1 ? "s" : ""} pour l'instant).${skipNote}`);
    else if (!p.length) setScanMessage(`Aucun pattern trouvé sur les ${scanned} projet${scanned > 1 ? "s" : ""} analysé${scanned > 1 ? "s" : ""}${totalEligible > scanned ? ` (sur ${totalEligible} au total)` : ""}.${skipNote}`);
    else if (skipNote) setScanMessage(skipNote.trim());
  }
  async function scanFeedbackPatterns() {
    setScanningFeedback(true); setFeedbackScanMessage(null);
    const proposals = await detectPromptFeedbackPatterns(promptFeedback);
    setFeedbackProposals(proposals);
    setScanningFeedback(false);
    if (promptFeedback.length < 2) setFeedbackScanMessage(`Il faut au moins 2 retours pour chercher une récurrence (${promptFeedback.length} pour l'instant).`);
    else if (!proposals.length) setFeedbackScanMessage(`Aucune récurrence trouvée sur les ${promptFeedback.length} retours analysés.`);
  }
  const SUB_TABS = [
    { id: "patterns", step: "1", label: "Observer", description: "Patterns détectés ou apportés" },
    { id: "requirements", step: "2", label: "Formaliser", description: "Portée et exigences moteur" },
    { id: "prompt", step: "3", label: "Socle", description: "Règles universelles" },
    { id: "discuter", step: "4", label: "Améliorer", description: "Discussion et évolution" },
    { id: "confidence", step: "5", label: "Confiance", description: "Preuves, impact et régressions" },
  ];
  return (
    <div className="max-w-2xl mx-auto px-5 py-6">
      <h2 className="font-display text-lg mb-3">Optimisation</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
        <div className="p-3 rounded-xl bg-surface border border-app text-center"><p className="text-xl font-display text-amber-400">{diagnosedCount}</p><p className="text-10 text-slate-500 mt-1">Projets diagnostiqués</p></div>
        <div className="p-3 rounded-xl bg-surface border border-app text-center"><p className="text-xl font-display text-amber-400">{customGoals.length}</p><p className="text-10 text-slate-500 mt-1">Questions promues</p></div>
        <div className="p-3 rounded-xl bg-surface border border-app text-center"><p className="text-xl font-display text-amber-400">{enginePatternCount}</p><p className="text-10 text-slate-500 mt-1">Patterns dans le moteur</p></div>
        <div className="p-3 rounded-xl bg-surface border border-app text-center"><p className="text-xl font-display text-amber-400">{establishedPatternCount}</p><p className="text-10 text-slate-500 mt-1">Patterns établis</p></div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-5">
        {SUB_TABS.map((t) => (
          <button key={t.id} onClick={() => setSubTab(t.id)} className={`p-2.5 rounded-xl text-left border transition-colors ${subTab === t.id ? "bg-amber-400 text-app border-amber-400" : "bg-surface border-app text-slate-400"}`}><span className="text-10 opacity-70">Étape {t.step}</span><span className="block text-12 font-medium mt-0.5">{t.label}</span><span className="block text-9 opacity-70 mt-0.5">{t.description}</span></button>
        ))}
      </div>

      <div style={{ display: subTab === "patterns" ? "block" : "none" }}>
        <div>
          <div className="mb-5 p-4 rounded-xl bg-amber-400/5 border border-amber-400/20">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="text-13 text-cream font-medium">Bibliothèque de patterns déjà constituée</p>
                <p className="text-11 text-slate-400 mt-1">{enginePatternCount} patterns conservés : {promisingPatternCount} prometteurs issus des simulations et {hypothesisPatternCount} hypothèses importées. Ils n'ont pas disparu ; ils sont classés dans le Socle pour être sélectionnés selon chaque projet.</p>
              </div>
              <button onClick={() => setSubTab("prompt")} className="shrink-0 text-11 px-3 py-1.5 rounded-full bg-amber-400 text-app">Voir les {enginePatternCount} patterns</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
              {engineRequirements.slice(0, 6).map((pattern) => <div key={pattern.id} className="p-2.5 rounded-lg bg-surface border border-app"><p className="text-11 text-slate-300">{pattern.label}</p><p className="text-9 text-slate-600 mt-1">{pattern.statut} · {requirementScopeId(pattern)} · {{ universel: "Universel", entreprise: "Entreprise", grand_public: "Grand public" }[pattern.publicCible || "universel"]}</p></div>)}
            </div>
            {enginePatternCount > 6 && <p className="text-10 text-slate-500 mt-2">+ {enginePatternCount - 6} autres patterns dans le Socle.</p>}
          </div>
          <div className="mb-5 p-4 rounded-xl bg-surface border border-app">
            <p className="text-12 text-cream font-medium">1. Observations internes</p>
            <p className="text-10 text-slate-600 mt-1 mb-3">Ce que NANDĒM observe dans les projets, les retours et la bibliothèque déjà constituée.</p>
          <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
            <p className="text-11 uppercase tracking-wider text-slate-500">Projets diagnostiqués & patterns</p>
            <div className="flex gap-2">
              <button onClick={scanProjects} disabled={scanning} className="flex items-center gap-1.5 text-12 px-3 py-1.5 rounded-full bg-amber-400 text-app disabled:opacity-50 transition-colors">{scanning ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />} Vérifier les patterns (auto)</button>
              <button onClick={scan} disabled={scanning || eligibleProjectCount < 2} className="flex items-center gap-1.5 text-12 px-3 py-1.5 rounded-full border border-app text-slate-400 hover:border-amber-400/30 hover:text-amber-300 disabled:opacity-30 transition-colors">{scanning ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />} Depuis la bibliothèque</button>
            </div>
          </div>
          <p className="text-10 text-slate-600 mb-3">"Auto" analyse directement les projets enregistrés, sans dépendre de ce que tu as ajouté à la main. Les patterns passés en "Établi" quittent cette liste et vivent dans Historique.</p>
          {scanMessage && <p className="text-11 text-amber-400/70 mb-4">{scanMessage}</p>}
          {library.length > MAX_PATTERN_LIBRARY_ENTRIES && <p className="text-10 text-slate-600 mb-3">{library.length} éléments au total — la détection analyse les {MAX_PATTERN_LIBRARY_ENTRIES} plus récents.</p>}
          {eligibleProjectCount < 2 && <p className="text-11 text-slate-600 mb-4">Le bouton "Depuis la bibliothèque" (pas "auto") demande au moins 2 projets avec des éléments ajoutés manuellement — sans rapport avec le résultat de "Vérifier les patterns (auto)" ci-dessus.</p>}
          {wasTruncated && proposals.length === 0 && !scanning && <p className="text-11 text-amber-400/70 mb-4">Analyse faite sur un échantillon — rien trouvé cette fois.</p>}
          {proposals.length > 0 && (<div className="mb-6 space-y-2"><p className="text-11 uppercase tracking-wider text-violet-300 mb-2">Propositions en attente — jamais appliquées sans toi</p>{proposals.map((p, i) => (<div key={i} className="p-3 rounded-xl bg-violet-400/5 border border-violet-400/20"><p className="text-13 text-cream font-medium">{p.label}</p><p className="text-12 text-slate-400 mt-1">{p.description}</p><p className="text-10 text-slate-600 mt-1.5 font-mono-data">{(p.projetsConcernes || []).join(" · ")} — jugé par l'IA : {p.niveauConfiance}</p><div className="flex gap-2 mt-2.5"><button onClick={() => { onAcceptProposal(p); setProposals(proposals.filter((_, idx) => idx !== i)); }} className="text-11 px-2.5 py-1 rounded-full bg-amber-400 text-app">{p.niveauConfiance === "Établi" ? "Valider → Historique" : "Valider"}</button><button onClick={() => setProposals(proposals.filter((_, idx) => idx !== i))} className="text-11 px-2.5 py-1 rounded-full border border-app text-slate-500">Rejeter</button></div></div>))}</div>)}
          </div>

          <div className="mb-5 p-4 rounded-xl bg-surface border border-app">
            <div className="flex items-center justify-between gap-3"><p className="text-12 text-cream font-medium">2. Observations que tu apportes</p><button onClick={() => setManualJsonOpen((v) => !v)} className="shrink-0 text-11 px-3 py-1.5 rounded-full border border-amber-400/30 text-amber-300 flex items-center gap-1.5"><FileText size={12} /> Importer JSON</button></div>
            <p className="text-10 text-slate-600 mt-1 mb-3">Une remarque, un pattern trouvé ailleurs ou une intuition. Elle reste une observation à valider avant de devenir une exigence.</p>
            {manualJsonOpen && <div className="p-3 rounded-xl bg-surface-2 border border-app mb-4">
              <p className="text-10 text-slate-500 mb-2">Sélectionne un fichier JSON ou colle son contenu. Formats acceptés : tableau direct, <span className="font-mono-data">{"{ observations: [...] }"}</span> ou <span className="font-mono-data">{"{ patterns: [...] }"}</span>.</p>
              <label className="inline-flex items-center gap-2 text-11 px-3 py-1.5 rounded-lg border border-app text-slate-300 cursor-pointer mb-2"><FolderOpen size={13} /> Choisir un fichier .json<input type="file" accept=".json,application/json" className="hidden" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; setManualJsonRaw(await file.text()); setManualJsonResult(null); }} /></label>
              <textarea value={manualJsonRaw} onChange={(e) => setManualJsonRaw(e.target.value)} rows={7} placeholder='{"observations":[{"label":"Mode sombre et clair","description":"Prévoir un thème adaptable…"}]}' className="w-full bg-surface border border-app rounded-lg px-3 py-2 text-10 font-mono-data placeholder:text-slate-600" />
              {manualJsonResult && (manualJsonResult.ok ? <p className="text-11 text-amber-300 mt-2">{manualJsonResult.added} observation(s) ajoutée(s), {manualJsonResult.rejected} rejetée(s).</p> : <p className="text-11 text-red-300 mt-2">Import refusé : {manualJsonResult.error}</p>)}
              <div className="flex justify-end mt-2"><button onClick={() => { try { const report = onImportManualObservations(manualJsonRaw); setManualJsonResult({ ok: true, ...report }); setManualJsonRaw(""); } catch (e) { setManualJsonResult({ ok: false, error: e.message }); } }} disabled={!manualJsonRaw.trim()} className="text-11 px-3 py-1.5 rounded-lg bg-amber-400 text-app disabled:opacity-40">Importer les observations</button></div>
            </div>}
            <input value={manualObservationLabel} onChange={(e) => setManualObservationLabel(e.target.value)} placeholder="Nom court de l'observation" className="w-full bg-surface-2 border border-app rounded-lg px-3 py-2 text-12 mb-2 placeholder:text-slate-600" />
            <textarea value={manualObservationText} onChange={(e) => setManualObservationText(e.target.value)} rows={3} placeholder="Décris ce qui se répète, dans quels cas, et les éventuels contre-exemples…" className="w-full bg-surface-2 border border-app rounded-lg px-3 py-2 text-12 placeholder:text-slate-600" />
            <button onClick={() => { onAddManualObservation(manualObservationLabel, manualObservationText); setManualObservationLabel(""); setManualObservationText(""); setManualObservationSaved(true); setTimeout(() => setManualObservationSaved(false), 1500); }} disabled={!manualObservationLabel.trim() || !manualObservationText.trim()} className="mt-2 text-11 px-3 py-1.5 rounded-full bg-amber-400 text-app disabled:opacity-40">{manualObservationSaved ? "Observation ajoutée" : "Ajouter l'observation"}</button>
            {library.filter((l) => l.projectId === "observation-importee").length > 0 && <div className="space-y-2 mt-4">{library.filter((l) => l.projectId === "observation-importee").map((item) => <div key={item.id} className="p-3 rounded-xl bg-surface-2 border border-app"><div className="flex items-start justify-between gap-2"><div><p className="text-12 text-cream">{item.fieldLabel}</p><p className="text-11 text-slate-400 mt-1">{item.text}</p><p className="text-9 text-violet-300 mt-1.5">Source manuelle · Hypothèse</p></div><button onClick={() => onRemove(item.id)} className="text-slate-600 hover:text-red-300"><Trash2 size={13} /></button></div></div>)}</div>}
          </div>
          {library.length === 0 ? <p className="text-slate-500 text-sm">Rien pour l'instant — ajoute des éléments depuis un cahier des charges de projet.</p> : (LIB_TYPES.map((typ) => {
            const items = library.filter((l) => l.projectId !== "observation-importee" && (l.type === typ.id || (!l.type && typ.id === "connaissance")) && l.statut !== "Établi");
            if (!items.length) return null;
            return (
              <div key={typ.id} className="mb-6">
                <p className="text-11 uppercase tracking-wider text-slate-400 mb-2">{typ.label}</p>
                <div className="space-y-2">
                  {items.map((item) => {
                    const g = LIB_GENERICITE.find((x) => x.id === item.category);
                    const currentStatut = item.statut || "À valider";
                    return (
                      <div key={item.id} className="p-3 rounded-xl bg-surface border border-app group">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap mb-1">
                              <span className="text-10 text-slate-500 font-mono-data">{item.fieldLabel} · {item.projectNom}</span>
                              {g && <span className={`text-9 px-1.5 py-0.5 rounded-full border ${g.color}`}>{g.label}</span>}
                            </div>
                            <p className="text-13 text-slate-300 leading-relaxed">{item.text}</p>
                            {item.justification && <p className="text-12 text-slate-500 mt-1 italic">Justification : {item.justification}</p>}
                            {item.source && <p className="text-12 text-slate-500 mt-1">Source : {item.source} — {item.niveauPreuve}</p>}
                            <div className="flex flex-wrap gap-1.5 mt-2.5">
                              {PATTERN_STATUTS.map((s) => (
                                <button key={s} onClick={() => onUpdateStatut(item.id, s)} className={`text-9 px-2 py-0.5 rounded-full border transition-colors ${currentStatut === s ? `${PATTERN_STATUT_STYLE[s]} bg-surface-2` : "border-app text-slate-600"}`}>{s}</button>
                              ))}
                            </div>
                            {item.category === "generique" && (item.promoted ? <p className="text-10 text-amber-400/70 mt-2">Déjà une question du diagnostic</p> : <button onClick={() => setPromotingEntry(item)} className="text-10 px-2 py-0.5 rounded-full border border-amber-400/30 text-amber-300 mt-2">Promouvoir en question</button>)}
                          </div>
                          <button onClick={() => onRemove(item.id)} className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all shrink-0"><Trash2 size={13} /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          }))}
          {promotingEntry && <PromotionEditor entry={promotingEntry} onCancel={() => setPromotingEntry(null)} onConfirm={(q, imp) => { onPromote(promotingEntry, q, imp); setPromotingEntry(null); }} />}
          {customGoals.length > 0 && (
            <div className="border-t border-app pt-5 mt-6">
              <p className="text-11 uppercase tracking-wider text-slate-500 mb-2">Questions ajoutées au diagnostic</p>
              <div className="space-y-1.5">{customGoals.map((g) => (<div key={g.id} className="px-3 py-2 rounded-lg bg-surface border border-app"><p className="text-12 text-cream">{g.label}</p><p className="text-11 text-slate-500 mt-0.5">{g.question}</p></div>))}</div>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: subTab === "requirements" ? "block" : "none" }}><FormalizationView observations={library} onAnalyze={onAnalyzeFormalization} onAccept={onAcceptFormalization} /></div>

      <div style={{ display: subTab === "confidence" ? "block" : "none" }}><EngineConfidenceView requirements={engineRequirements} observations={library} index={index} questionOverrides={questionOverrides} promptFeedback={promptFeedback} /></div>

      <div style={{ display: subTab === "prompt" ? "block" : "none" }}>
        <div>
          <EngineRequirementsView requirements={engineRequirements} observations={library} onImport={onImportRequirements} onRemove={onRemoveRequirement} onUpdate={onUpdateRequirement} promptAddendum={promptAddendum} />
          <div className="border-t border-app pt-5 mt-6">
          <div className="grid grid-cols-1 gap-2 mb-5">
            <div className="p-3 rounded-xl bg-surface border border-app text-center"><p className="text-xl font-display text-amber-400">{promptFeedback.filter((f) => f.promoted).length}</p><p className="text-10 text-slate-500 mt-1">Améliorations du dossier universel intégrées</p></div>
          </div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-11 uppercase tracking-wider text-slate-500">Retours sur les dossiers de construction</p>
            <button onClick={scanFeedbackPatterns} disabled={scanningFeedback} className="flex items-center gap-1.5 text-11 px-2.5 py-1.5 rounded-full bg-amber-400 text-app disabled:opacity-50">{scanningFeedback ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />} Analyser les retours</button>
          </div>
          {feedbackScanMessage && <p className="text-11 text-amber-400/70 mb-4">{feedbackScanMessage}</p>}
          {feedbackProposals.length > 0 && (
            <div className="mb-6 space-y-2">
              <p className="text-11 uppercase tracking-wider text-violet-300 mb-2">Récurrences détectées — jamais appliquées sans toi</p>
              {feedbackProposals.map((p, i) => (
                <div key={i} className="p-3 rounded-xl bg-violet-400/5 border border-violet-400/20">
                  <p className="text-13 text-cream font-medium">{p.label}</p>
                  <p className="text-12 text-slate-400 mt-1">{p.description}</p>
                  <p className="text-10 text-slate-600 mt-1.5 font-mono-data">{p.niveauConfiance}</p>
                  <div className="flex gap-2 mt-2.5">
                    <button onClick={() => { onPromoteSynthesized(p.description); setFeedbackProposals(feedbackProposals.filter((_, idx) => idx !== i)); }} className="text-11 px-2.5 py-1 rounded-full bg-amber-400 text-app">Intégrer dans tous les prochains prompts</button>
                    <button onClick={() => setFeedbackProposals(feedbackProposals.filter((_, idx) => idx !== i))} className="text-11 px-2.5 py-1 rounded-full border border-app text-slate-500">Ignorer</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {promptFeedback.filter((f) => !f.promoted).length > 0 && (
            <div className="mb-6">
              <p className="text-11 uppercase tracking-wider text-violet-300 mb-2">Retours sur le prompt — en attente</p>
              <div className="space-y-2">
                {promptFeedback.filter((f) => !f.promoted).map((f) => (
                  <div key={f.id} className="p-3 rounded-xl bg-violet-400/5 border border-violet-400/20">
                    <p className="text-11 text-slate-500 font-mono-data mb-1">{f.projectNom}</p>
                    <p className="text-13 text-slate-300">{f.text}</p>
                    <div className="flex gap-2 mt-2.5">
                      <button onClick={() => onPromoteFeedback(f.id)} className="text-11 px-2.5 py-1 rounded-full bg-amber-400 text-app">Intégrer dans tous les prochains prompts</button>
                      <button onClick={() => onDismissFeedback(f.id)} className="text-11 px-2.5 py-1 rounded-full border border-app text-slate-500">Ignorer</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {promptAddendum && (
            <div className="mb-6">
              <p className="text-11 uppercase tracking-wider text-slate-500 mb-2">Leçons déjà intégrées à chaque prompt</p>
              <div className="p-3 rounded-xl bg-surface border border-app text-12 text-slate-300 whitespace-pre-line">{promptAddendum}</div>
            </div>
          )}
          </div>
        </div>
      </div>

      <div style={{ display: subTab === "discuter" ? "block" : "none" }}>
        <PromptEngineeringWorkspace diagnosedCount={diagnosedCount} overrides={questionOverrides} onAnalyzeQuestionnaires={onAnalyzeQuestionnaires} onAcceptQuestionImprovement={onAcceptQuestionImprovement} onRevertQuestionImprovement={onRevertQuestionImprovement} promptAddendum={promptAddendum} onPromoteSynthesized={onPromoteSynthesized} />
      </div>
    </div>
  );
}
function ReglagesView({ settings, onSave, onReplayOnboarding, theme, setTheme, apiKey, onSaveApiKey, customAiKey, onSaveCustomAiKey, onExportAll, onImportAll }) {
  const [studioName, setStudioName] = useState(settings.studioName);
  const [feedbackEmail, setFeedbackEmail] = useState(settings.feedbackEmail);
  const [bio, setBio] = useState(settings.bio || "");
  const [tarifIndicatif, setTarifIndicatif] = useState(settings.tarifIndicatif || "");
  const [tarifFaible, setTarifFaible] = useState(settings.tarifFaible ?? "");
  const [tarifMoyenne, setTarifMoyenne] = useState(settings.tarifMoyenne ?? "");
  const [tarifElevee, setTarifElevee] = useState(settings.tarifElevee ?? "");
  // Taux horaire (27/08/2026) — sert à évaluer le coût réel d'un projet à
  // partir du temps saisi (FinanceSection), indépendamment du prix forfaitaire
  // annoncé au client (tarifFaible/Moyenne/Elevee). Facultatif : sans lui, le
  // temps reste affiché à titre indicatif (en heures) sans conversion en €.
  const [tarifHoraire, setTarifHoraire] = useState(settings.tarifHoraire ?? "");
  const [saved, setSaved] = useState(false);
  // Fournisseur IA choisi par le porteur (27/08/2026) — indépendant de tout
  // fournisseur en particulier, comme demandé : "je peux vouloir choisir pour
  // ne pas être dépendant d'une IA en particulier". Change en un clic, sans
  // toucher au code ni relancer le serveur (le relais lit ce choix via un
  // en-tête à chaque appel, cf callAnthropic()).
  const [aiProvider, setAiProviderInput] = useState(settings.aiProvider || "anthropic");
  const [providerSaved, setProviderSaved] = useState(false);
  // Fournisseur générique "API compatible OpenAI" (27/08/2026) — un 3e choix
  // qui couvre n'importe quel service parlant ce format (OpenAI, Mistral,
  // Groq, OpenRouter, DeepSeek...) via une URL de base + une clé + un modèle,
  // au lieu de coder chaque fournisseur un par un.
  const [customAiBaseUrl, setCustomAiBaseUrl] = useState(settings.customAiBaseUrl || "");
  const [customAiModel, setCustomAiModel] = useState(settings.customAiModel || "");
  const [customAiKeyInput, setCustomAiKeyInput] = useState(customAiKey || "");
  const [customAiSaved, setCustomAiSaved] = useState(false);
  const [showCustomKey, setShowCustomKey] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(apiKey || "");
  const [apiSaved, setApiSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);
  // Épuration de l'écran Réglages (27/08/2026) : une carte déjà remplie se
  // replie en résumé + icône crayon au lieu de garder tous ses champs et
  // boutons visibles en permanence. Ouverte par défaut seulement si elle n'a
  // encore aucune donnée réelle (premier remplissage) ; se referme au clic
  // sur Enregistrer. Ne concerne PAS la carte "Fournisseur IA" (appels IA),
  // laissée telle quelle à la demande du porteur.
  const [editingProfil, setEditingProfil] = useState(!settings.studioName || settings.studioName === PLACEHOLDER_STUDIO);
  const [editingTarifs, setEditingTarifs] = useState(settings.tarifFaible == null && settings.tarifMoyenne == null && settings.tarifElevee == null);
  const [editingApiKey, setEditingApiKey] = useState(!apiKey);
  const [exporting, setExporting] = useState(false);
  const [exportedJson, setExportedJson] = useState(null);
  const [copiedExport, setCopiedExport] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importConfirm, setImportConfirm] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  function buildSettingsPayload(overrides = {}) {
    return {
      studioName, feedbackEmail, bio, tarifIndicatif,
      tarifFaible: tarifFaible === "" ? null : Number(tarifFaible),
      tarifMoyenne: tarifMoyenne === "" ? null : Number(tarifMoyenne),
      tarifElevee: tarifElevee === "" ? null : Number(tarifElevee),
      tarifHoraire: tarifHoraire === "" ? null : Number(tarifHoraire),
      aiProvider, customAiBaseUrl, customAiModel,
      ...overrides,
    };
  }
  function save() { onSave(buildSettingsPayload()); setSaved(true); setEditingProfil(false); setTimeout(() => setSaved(false), 1500); }
  function saveTarifs() { onSave(buildSettingsPayload()); setSaved(true); setEditingTarifs(false); setTimeout(() => setSaved(false), 1500); }
  function saveKey() { onSaveApiKey(apiKeyInput.trim()); setApiSaved(true); setEditingApiKey(false); setTimeout(() => setApiSaved(false), 1500); }
  function saveProvider(next) { setAiProviderInput(next); onSave(buildSettingsPayload({ aiProvider: next })); setProviderSaved(true); setTimeout(() => setProviderSaved(false), 1500); }
  // Enregistre en un clic l'URL de base + le modèle (réglages publics) ET la
  // clé (stockage séparé, cf onSaveCustomAiKey) — les trois sont nécessaires
  // ensemble pour qu'un appel "custom" fonctionne.
  function saveCustomAi() {
    onSave(buildSettingsPayload({ customAiBaseUrl: customAiBaseUrl.trim(), customAiModel: customAiModel.trim() }));
    onSaveCustomAiKey(customAiKeyInput.trim());
    setCustomAiSaved(true); setTimeout(() => setCustomAiSaved(false), 1500);
  }
  async function doExport() {
    setExporting(true);
    try { setExportedJson(await onExportAll()); } catch { setExportedJson(null); }
    setExporting(false);
  }
  async function copyExport() {
    if (!exportedJson) return;
    try { if (!navigator.clipboard) throw new Error("indisponible"); await navigator.clipboard.writeText(exportedJson); setCopiedExport(true); setTimeout(() => setCopiedExport(false), 1800); } catch {}
  }
  function downloadExport() {
    if (!exportedJson) return;
    try {
      const blob = new Blob([exportedJson], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `nandem-core-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {}
  }
  async function doImport() {
    if (!importText.trim() || !importConfirm) return;
    setImporting(true);
    try { await onImportAll(importText); setImportResult({ ok: true }); setImportText(""); setImportConfirm(false); }
    catch (e) { setImportResult({ ok: false, error: e.message }); }
    setImporting(false);
  }
  return (
    <div className="max-w-2xl mx-auto px-5 py-6">
      <h2 className="font-display text-lg mb-4">Réglages</h2>
      <div className="p-4 rounded-xl bg-surface border border-app mb-5">
        <div className="flex items-center justify-between">
          <p className="text-11 uppercase tracking-wider text-slate-500">Apparence</p>
          {/* Un seul bouton icône au lieu de deux boutons pleine largeur
              (27/08/2026) — même choix (sombre/clair), présentation plus
              épurée. Un clic bascule vers l'autre mode ; l'icône affichée est
              celle du mode ACTUEL (convention la plus courante : "Sombre"
              actif → icône lune, clique pour passer en clair, etc. — ici on
              montre plutôt l'action possible, cf title). */}
          <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="p-2 rounded-lg bg-surface-2 border border-app text-amber-300 hover:border-amber-400/40 transition-colors" title={theme === "dark" ? "Passer en mode clair" : "Passer en mode sombre"}>
            {theme === "dark" ? <Moon size={16} /> : <Sun size={16} />}
          </button>
        </div>
      </div>
      <div className="p-4 rounded-xl bg-surface border border-app mb-5">
        <p className="text-11 uppercase tracking-wider text-slate-500 mb-2">Sauvegarde complète</p>
        <p className="text-11 text-slate-400 mb-3 leading-relaxed">Exporte tout — projets, bibliothèque, prompts affinés, réglages — dans un fichier que tu gardes chez toi. C'est le seul moyen de ne rien perdre de ce que la bêta a appris avant un vrai déploiement, puisque ces données ne quittent jamais cette session Claude automatiquement.</p>
        <div className="flex gap-2 mb-3">
          <button onClick={doExport} disabled={exporting} className="flex-1 py-2.5 rounded-xl bg-amber-400 text-app text-sm flex items-center justify-center gap-2 disabled:opacity-50">{exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}{exporting ? "Préparation…" : "Exporter tout"}</button>
        </div>
        {exportedJson && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-11 text-slate-500">Copie ce texte et garde-le en lieu sûr (note, fichier...).</p>
              <button onClick={copyExport} className="p-1.5 rounded-lg hover:bg-surface-2 text-slate-400 hover:text-amber-300 shrink-0">{copiedExport ? <Check size={14} className="text-amber-400" /> : <Copy size={14} />}</button>
            </div>
            <textarea readOnly value={exportedJson} onFocus={(e) => e.target.select()} rows={6} className="w-full bg-surface-2 border border-app rounded-lg p-2.5 text-10 text-slate-300 font-mono-data mb-2" />
            <button onClick={downloadExport} className="w-full py-2 rounded-lg bg-surface-2 border border-app text-12 text-slate-300 flex items-center justify-center gap-2"><Download size={13} /> Essayer de télécharger le fichier .json</button>
            <p className="text-10 text-slate-600 mt-1.5">Le téléchargement direct peut ne pas fonctionner selon l'appareil — le copier-coller ci-dessus reste la solution fiable.</p>
          </div>
        )}
        <button onClick={() => setImportOpen(!importOpen)} className="text-13 text-slate-400 hover:text-amber-300 transition-colors">{importOpen ? "Masquer la restauration" : "Restaurer une sauvegarde →"}</button>
        {importOpen && (
          <div className="mt-3 pt-3 border-t border-app-soft">
            <p className="text-11 text-red-300 mb-2">⚠️ Remplace les données actuelles de cet appareil par celles de la sauvegarde collée ci-dessous. Pas de fusion — vérifie que c'est bien ce que tu veux.</p>
            <textarea value={importText} onChange={(e) => setImportText(e.target.value)} rows={6} placeholder="Colle ici le JSON exporté précédemment…" className="w-full bg-surface-2 border border-app rounded-lg p-2.5 text-10 text-slate-300 font-mono-data mb-2" />
            <label className="flex items-center gap-2 text-12 text-slate-400 mb-2">
              <input type="checkbox" checked={importConfirm} onChange={(e) => setImportConfirm(e.target.checked)} />
              Je comprends que ça remplace les données actuelles
            </label>
            {importResult && (importResult.ok ? <p className="text-12 text-amber-300 mb-2">Restauré avec succès.</p> : <p className="text-12 text-red-300 mb-2">Échec ({importResult.error}) — vérifie que le texte collé est bien complet.</p>)}
            <button onClick={doImport} disabled={!importText.trim() || !importConfirm || importing} className="w-full py-2.5 rounded-xl bg-red-400/80 text-app text-sm flex items-center justify-center gap-2 disabled:opacity-40">{importing ? <Loader2 size={15} className="animate-spin" /> : null}{importing ? "Restauration…" : "Restaurer"}</button>
          </div>
        )}
      </div>
      <div className="p-4 rounded-xl bg-surface border border-app mb-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-11 uppercase tracking-wider text-slate-500">Visibles par tes clients (lien Discovery)</p>
          {!editingProfil && <button onClick={() => setEditingProfil(true)} className="p-1.5 rounded-lg hover:bg-surface-2 text-slate-400 hover:text-amber-300 shrink-0" title="Modifier"><Pencil size={13} /></button>}
        </div>
        {editingProfil ? (
          <>
            <label className="text-12 text-slate-500 block mb-1">Nom affiché</label>
            <input value={studioName} onChange={(e) => setStudioName(e.target.value)} className="w-full bg-surface-2 border border-app rounded-lg px-3 py-2 text-13 mb-3 focus:outline-none focus:ring-1 focus:ring-amber-400/40" />
            <label className="text-12 text-slate-500 block mb-1">Email de réception des diagnostics</label>
            <input value={feedbackEmail} onChange={(e) => setFeedbackEmail(e.target.value)} className="w-full bg-surface-2 border border-app rounded-lg px-3 py-2 text-13 mb-3 focus:outline-none focus:ring-1 focus:ring-amber-400/40" />
            <label className="text-12 text-slate-500 block mb-1">Présentation courte (rassure un client qui ne te connaît pas)</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={2} placeholder="Ex : Studio indépendant, apps sur mesure livrées en 2-4 semaines." className="w-full bg-surface-2 border border-app rounded-lg px-3 py-2 text-13 mb-3 focus:outline-none focus:ring-1 focus:ring-amber-400/40" />
            <label className="text-12 text-slate-500 block mb-1">Fourchette de prix indicative (facultatif)</label>
            <input value={tarifIndicatif} onChange={(e) => setTarifIndicatif(e.target.value)} placeholder="Ex : à partir de 500 €" className="w-full bg-surface-2 border border-app rounded-lg px-3 py-2 text-13 mb-3 focus:outline-none focus:ring-1 focus:ring-amber-400/40" />
            <button onClick={save} className="text-13 bg-amber-400 text-app px-4 py-1.5 rounded-lg">{saved ? "Enregistré" : "Enregistrer"}</button>
          </>
        ) : (
          <div className="text-12 text-slate-400 space-y-0.5">
            <p className="text-13 text-slate-200">{studioName}</p>
            <p>{feedbackEmail}</p>
            {tarifIndicatif && <p>{tarifIndicatif}</p>}
          </div>
        )}
      </div>
      <div className="p-4 rounded-xl bg-surface border border-app mb-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-11 uppercase tracking-wider text-slate-500">Tarification par complexité</p>
          {!editingTarifs && <button onClick={() => setEditingTarifs(true)} className="p-1.5 rounded-lg hover:bg-surface-2 text-slate-400 hover:text-amber-300 shrink-0" title="Modifier"><Pencil size={13} /></button>}
        </div>
        {editingTarifs ? (
          <>
            <p className="text-11 text-slate-400 mb-3 leading-relaxed">Utilisé pour générer un devis chiffré automatiquement (dans Facturation). Plancher absolu : {PRIX_MINIMUM} € — jamais en dessous, même si un champ est laissé vide.</p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div>
                <label className="text-11 text-slate-500 block mb-1">Faible</label>
                <input type="number" value={tarifFaible} onChange={(e) => setTarifFaible(e.target.value)} placeholder="300" className="w-full bg-surface-2 border border-app rounded-lg px-2.5 py-2 text-13 focus:outline-none focus:ring-1 focus:ring-amber-400/40" />
              </div>
              <div>
                <label className="text-11 text-slate-500 block mb-1">Moyenne</label>
                <input type="number" value={tarifMoyenne} onChange={(e) => setTarifMoyenne(e.target.value)} placeholder="600" className="w-full bg-surface-2 border border-app rounded-lg px-2.5 py-2 text-13 focus:outline-none focus:ring-1 focus:ring-amber-400/40" />
              </div>
              <div>
                <label className="text-11 text-slate-500 block mb-1">Élevée</label>
                <input type="number" value={tarifElevee} onChange={(e) => setTarifElevee(e.target.value)} placeholder="1200" className="w-full bg-surface-2 border border-app rounded-lg px-2.5 py-2 text-13 focus:outline-none focus:ring-1 focus:ring-amber-400/40" />
              </div>
            </div>
            <label className="text-11 text-slate-500 block mb-1">Taux horaire (facultatif — pour évaluer le coût réel du temps passé)</label>
            <input type="number" value={tarifHoraire} onChange={(e) => setTarifHoraire(e.target.value)} placeholder="Ex : 45" className="w-full bg-surface-2 border border-app rounded-lg px-2.5 py-2 text-13 mb-3 focus:outline-none focus:ring-1 focus:ring-amber-400/40" />
            <button onClick={saveTarifs} className="text-13 bg-amber-400 text-app px-4 py-1.5 rounded-lg">{saved ? "Enregistré" : "Enregistrer"}</button>
          </>
        ) : (
          <p className="text-12 text-slate-400">Faible {tarifFaible || "—"} € · Moyenne {tarifMoyenne || "—"} € · Élevée {tarifElevee || "—"} €{tarifHoraire && ` · ${tarifHoraire} €/h`}</p>
        )}
      </div>
      <div className="p-4 rounded-xl bg-surface border border-app mb-5">
        <p className="text-11 uppercase tracking-wider text-slate-500 mb-2">Fournisseur IA</p>
        <p className="text-11 text-slate-400 mb-3 leading-relaxed">
          Décide qui répond aux boutons IA (synthèse, prompt, suggestions). Change en un clic, sans toucher au code ni relancer le serveur — seulement utile hors de l'aperçu Claude (déploiement local ou Vercel).
        </p>
        <div className="flex gap-2 mb-2">
          <button onClick={() => saveProvider("anthropic")} className={`flex-1 py-2.5 rounded-xl text-13 border text-left px-3 ${aiProvider === "anthropic" ? "bg-amber-400 text-app border-amber-400" : "border-app text-slate-400"}`}>
            <span className="block font-medium">Anthropic (Claude)</span>
            <span className="block text-11 opacity-80 mt-0.5">Nécessite une clé API (section ci-dessous).</span>
          </button>
          <button onClick={() => saveProvider("lmstudio")} className={`flex-1 py-2.5 rounded-xl text-13 border text-left px-3 ${aiProvider === "lmstudio" ? "bg-amber-400 text-app border-amber-400" : "border-app text-slate-400"}`}>
            <span className="block font-medium">LM Studio (local)</span>
            <span className="block text-11 opacity-80 mt-0.5">Aucune clé, aucun coût — nécessite LM Studio ouvert sur ta machine.</span>
          </button>
          <button onClick={() => saveProvider("custom")} className={`flex-1 py-2.5 rounded-xl text-13 border text-left px-3 ${aiProvider === "custom" ? "bg-amber-400 text-app border-amber-400" : "border-app text-slate-400"}`}>
            <span className="block font-medium">API compatible OpenAI</span>
            <span className="block text-11 opacity-80 mt-0.5">N'importe quel fournisseur (OpenAI, Mistral, Groq, OpenRouter...).</span>
          </button>
        </div>
        {providerSaved && <p className="text-11 text-amber-300 mb-2">Enregistré.</p>}
        {aiProvider === "custom" && (
          <div className="mt-3 pt-3 border-t border-app-soft">
            <label className="text-12 text-slate-500 block mb-1">URL de base (format OpenAI, sans /chat/completions)</label>
            <input value={customAiBaseUrl} onChange={(e) => setCustomAiBaseUrl(e.target.value)} placeholder="Ex : https://api.openai.com/v1 ou https://openrouter.ai/api/v1" className="w-full bg-surface-2 border border-app rounded-lg px-3 py-2 text-13 mb-3 focus:outline-none focus:ring-1 focus:ring-amber-400/40" />
            <label className="text-12 text-slate-500 block mb-1">Modèle (facultatif — nécessaire pour la plupart des fournisseurs hors LM Studio)</label>
            <input value={customAiModel} onChange={(e) => setCustomAiModel(e.target.value)} placeholder="Ex : gpt-4o-mini, mistral-large-latest..." className="w-full bg-surface-2 border border-app rounded-lg px-3 py-2 text-13 mb-3 focus:outline-none focus:ring-1 focus:ring-amber-400/40" />
            <label className="text-12 text-slate-500 block mb-1">Clé API</label>
            <div className="flex gap-2 mb-3">
              <input type={showCustomKey ? "text" : "password"} value={customAiKeyInput} onChange={(e) => setCustomAiKeyInput(e.target.value)} placeholder="sk-..." className="flex-1 bg-surface-2 border border-app rounded-lg px-3 py-2 text-13 focus:outline-none focus:ring-1 focus:ring-amber-400/40" />
              <button onClick={() => setShowCustomKey(!showCustomKey)} className="px-3 rounded-lg bg-surface-2 border border-app text-slate-400 text-12 shrink-0">{showCustomKey ? "Cacher" : "Voir"}</button>
            </div>
            <p className="text-10 text-red-300 mb-3">⚠️ Comme la clé Anthropic, visible dans le navigateur si l'appli est déployée publiquement — réservé à tes tests privés.</p>
            <button onClick={saveCustomAi} className="text-13 bg-amber-400 text-app px-4 py-1.5 rounded-lg">{customAiSaved ? "Enregistré" : "Enregistrer"}</button>
          </div>
        )}
      </div>
      <div className="p-4 rounded-xl bg-surface border border-red-400/30 mb-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-11 uppercase tracking-wider text-red-300">API Anthropic — pour déploiement hors Claude uniquement</p>
          {!editingApiKey && <button onClick={() => setEditingApiKey(true)} className="p-1.5 rounded-lg hover:bg-surface-2 text-slate-400 hover:text-amber-300 shrink-0" title="Modifier"><Pencil size={13} /></button>}
        </div>
        {editingApiKey ? (
          <>
            <p className="text-11 text-slate-400 mb-3 leading-relaxed">
              Nécessaire seulement si tu déploies cette appli hors de l'aperçu Claude (ex. CodeSandbox), où l'appel API n'a plus d'authentification automatique.
              ⚠️ Cette clé sera visible dans le navigateur de quiconque ouvre la page déployée (inspecteur réseau) — <span className="text-red-300">ne jamais la renseigner sur une version dont le lien circule publiquement ou est envoyé à des clients</span>. Réservé à tes tests privés.
            </p>
            <div className="flex gap-2 mb-3">
              <input type={showKey ? "text" : "password"} value={apiKeyInput} onChange={(e) => setApiKeyInput(e.target.value)} placeholder="sk-ant-..." className="flex-1 bg-surface-2 border border-app rounded-lg px-3 py-2 text-13 focus:outline-none focus:ring-1 focus:ring-amber-400/40" />
              <button onClick={() => setShowKey(!showKey)} className="px-3 rounded-lg bg-surface-2 border border-app text-slate-400 text-12 shrink-0">{showKey ? "Cacher" : "Voir"}</button>
            </div>
            <div className="flex gap-2">
              <button onClick={saveKey} className="text-13 bg-amber-400 text-app px-4 py-1.5 rounded-lg">{apiSaved ? "Enregistrée" : "Enregistrer la clé"}</button>
              {apiKey && <button onClick={() => { setApiKeyInput(""); onSaveApiKey(""); setEditingApiKey(true); }} className="text-13 text-red-300 px-4 py-1.5">Retirer</button>}
            </div>
          </>
        ) : (
          <p className="text-12 text-slate-400">Une clé est actuellement enregistrée sur cet appareil.</p>
        )}
      </div>
      <button onClick={onReplayOnboarding} className="w-full py-2.5 rounded-xl bg-surface-2 border border-app text-sm text-slate-300 hover:border-amber-400/30 transition-colors flex items-center justify-center gap-2"><HelpCircle size={15} /> Revoir l'introduction</button>
    </div>
  );
}

function HistoriqueView({ index, onArchiveProject, onSelectProject, library, onUpdateStatut, onRemove }) {
  // Historique restructuré en 3 onglets (27/08/2026), à la demande du porteur
  // — Projets / Factures / Patterns étaient auparavant mélangés (liste de
  // projets + panneau dépliable de patterns), moins lisible une fois les
  // factures ajoutées à côté.
  const [histTab, setHistTab] = useState("projets");
  const [confirmId, setConfirmId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [loadedConversation, setLoadedConversation] = useState(null);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [copiedConv, setCopiedConv] = useState(false);
  const sorted = index.filter((p) => !p.archived).sort((a, b) => new Date(b.date) - new Date(a.date));
  const etablis = library.filter((l) => l.statut === "Établi");

  // Factures — chargées à la demande (comme les totaux de Facturation) : pas
  // de duplication de la vérité dans l'index, l'index ne contient que les
  // champs légers (nom, catégorie, pipeline, date), pas finance/facture.
  const [factures, setFactures] = useState(null);
  const [loadingFactures, setLoadingFactures] = useState(false);
  const [expandedFactureId, setExpandedFactureId] = useState(null);
  const [copiedFactureId, setCopiedFactureId] = useState(null);
  async function loadFactures() {
    setLoadingFactures(true);
    const found = [];
    for (const p of sorted) {
      try {
        const r = await window.storage.get(`nandem-project:${p.id}`);
        if (r) { const full = JSON.parse(r.value); if (full.facture?.numero || full.facture?.montant != null) found.push({ id: p.id, nom: p.nom, facture: full.facture }); }
      } catch {}
    }
    setFactures(found);
    setLoadingFactures(false);
  }
  async function copyFactureContent(id, content) {
    try { if (!navigator.clipboard) throw new Error("indisponible"); await navigator.clipboard.writeText(content); setCopiedFactureId(id); setTimeout(() => setCopiedFactureId(null), 1800); } catch {}
  }

  async function toggleConversation(id) {
    if (expandedId === id) { setExpandedId(null); setLoadedConversation(null); return; }
    setExpandedId(id); setLoadingConversation(true); setLoadedConversation(null);
    try {
      const r = await window.storage.get(`nandem-project:${id}`);
      const full = r ? JSON.parse(r.value) : null;
      setLoadedConversation(full?.conversation || []);
    } catch { setLoadedConversation([]); }
    setLoadingConversation(false);
  }
  async function copyConversation() {
    const text = formatTranscript(loadedConversation);
    try { if (!navigator.clipboard) throw new Error("indisponible"); await navigator.clipboard.writeText(text); setCopiedConv(true); setTimeout(() => setCopiedConv(false), 1800); } catch {}
  }
  function downloadConversation(nom) {
    try {
      const text = formatTranscript(loadedConversation);
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `conversation-${nom.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.txt`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {}
  }

  return (
    <div className="max-w-2xl mx-auto px-5 py-6">
      <h2 className="font-display text-lg mb-4">Historique</h2>

      <div className="flex gap-1.5 mb-5">
        {[["projets", "Projets"], ["factures", "Factures"], ["patterns", "Patterns"]].map(([id, label]) => (
          <button key={id} onClick={() => { setHistTab(id); if (id === "factures" && factures === null) loadFactures(); }} className={`flex-1 py-2 rounded-lg text-13 border transition-colors ${histTab === id ? "bg-amber-400 text-app border-amber-400" : "border-app text-slate-400"}`}>{label}</button>
        ))}
      </div>

      {histTab === "projets" && (
        <>
          <p className="text-11 text-slate-600 mb-4">Toutes tes fiches projets actives. Une fiche supprimée disparaît d'ici et va dans Corbeille. Déplie une fiche pour voir sa conversation du questionnaire.</p>
          {sorted.length === 0 && <p className="text-slate-500 text-sm">Aucune fiche pour l'instant.</p>}
          <div className="space-y-2">
            {sorted.map((p) => (
              <div key={p.id} className="rounded-xl bg-surface border border-app overflow-hidden">
                <div className="flex items-center justify-between gap-2 p-3">
                  <button onClick={() => onSelectProject(p.id)} className="text-left min-w-0 flex-1">
                    <p className="text-13 text-cream truncate">{p.nom}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className="text-10 px-2 py-0.5 rounded-full border border-app text-slate-500">{p.categorie}</span>
                      <span className="text-10 px-2 py-0.5 rounded-full border border-amber-400/20 text-amber-400/70">{p.pipeline || "Prospect"}</span>
                      <span className="text-10 text-slate-600 font-mono-data">{new Date(p.date).toLocaleDateString("fr-FR")}</span>
                    </div>
                  </button>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => toggleConversation(p.id)} title="Voir la conversation" className={`p-1.5 rounded-lg border transition-colors ${expandedId === p.id ? "bg-amber-400 text-app border-amber-400" : "border-app text-slate-400 hover:text-amber-300 hover:border-amber-400/30"}`}><MessageSquare size={13} /></button>
                    {confirmId === p.id ? (
                      <div className="flex gap-1.5">
                        <button onClick={() => setConfirmId(null)} className="text-11 px-2 py-1 rounded-full border border-app text-slate-500">Annuler</button>
                        <button onClick={() => { onArchiveProject(p.id); setConfirmId(null); }} className="text-11 px-2 py-1 rounded-full bg-red-400/80 text-app">Confirmer</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmId(p.id)} className="text-11 px-2.5 py-1 rounded-full border border-app text-slate-400 hover:border-red-400/40 hover:text-red-300">Supprimer</button>
                    )}
                  </div>
                </div>
                {expandedId === p.id && (
                  <div className="px-3 pb-3">
                    {loadingConversation ? (
                      <Loader2 size={16} className="animate-spin text-amber-400" />
                    ) : !loadedConversation?.length ? (
                      <p className="text-11 text-slate-600">Aucune conversation enregistrée pour ce projet.</p>
                    ) : (
                      <div className="p-3 rounded-xl bg-surface-2 border border-app">
                        <div className="flex gap-2 mb-2">
                          <button onClick={copyConversation} className="flex-1 py-1.5 rounded-lg bg-surface border border-app text-11 text-slate-300 flex items-center justify-center gap-1.5">{copiedConv ? <Check size={12} /> : <Copy size={12} />}{copiedConv ? "Copié" : "Copier"}</button>
                          <button onClick={() => downloadConversation(p.nom)} className="flex-1 py-1.5 rounded-lg bg-amber-400 text-app text-11 flex items-center justify-center gap-1.5"><Download size={12} /> Télécharger (.txt)</button>
                        </div>
                        <div className="space-y-1.5 max-h-64 overflow-y-auto">
                          {loadedConversation.map((m, i) => (
                            <div key={i} className={`text-11 px-2.5 py-1.5 rounded-lg ${m.role === "user" ? "bg-amber-400/5 text-amber-200" : "bg-surface text-slate-400"}`}>{m.text}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {histTab === "factures" && (
        <>
          <p className="text-11 text-slate-600 mb-4">Toutes les factures émises (générées depuis la fiche d'un projet, une fois un paiement enregistré).</p>
          {loadingFactures ? (
            <Loader2 size={16} className="animate-spin text-amber-400" />
          ) : !factures?.length ? (
            <p className="text-slate-500 text-sm">Aucune facture émise pour l'instant — elles se créent depuis Facturation, une fois le client payé.</p>
          ) : (
            <div className="space-y-2">
              {factures.map((f) => (
                <div key={f.id} className="rounded-xl bg-surface border border-app overflow-hidden">
                  <button onClick={() => setExpandedFactureId(expandedFactureId === f.id ? null : f.id)} className="w-full flex items-center justify-between gap-2 p-3 text-left">
                    <div className="min-w-0 flex-1">
                      <p className="text-13 text-cream truncate">{f.nom}</p>
                      <p className="text-11 text-slate-500 mt-0.5">{f.facture.numero ? `N° ${f.facture.numero}` : "Sans numéro"} · {f.facture.montant != null ? `${f.facture.montant} €` : "montant non précisé"}{f.facture.date ? ` · ${new Date(f.facture.date).toLocaleDateString("fr-FR")}` : ""}</p>
                    </div>
                    <ChevronDown size={14} className={`text-slate-500 shrink-0 transition-transform ${expandedFactureId === f.id ? "rotate-180" : ""}`} />
                  </button>
                  {expandedFactureId === f.id && (
                    <div className="px-3 pb-3">
                      {f.facture.content && <div className="p-3 rounded-lg bg-surface-2 border border-app-soft text-11 text-slate-300 whitespace-pre-line leading-relaxed max-h-56 overflow-y-auto mb-2">{f.facture.content}</div>}
                      <div className="flex gap-2">
                        {f.facture.content && <button onClick={() => copyFactureContent(f.id, f.facture.content)} className="flex-1 py-1.5 rounded-lg bg-amber-400 text-app text-11 flex items-center justify-center gap-1.5">{copiedFactureId === f.id ? <Check size={12} /> : <Copy size={12} />}{copiedFactureId === f.id ? "Copié" : "Copier"}</button>}
                        <button onClick={() => onSelectProject(f.id)} className="flex-1 py-1.5 rounded-lg bg-surface-2 border border-app text-11 text-slate-300">Voir le projet</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {histTab === "patterns" && (
        <>
          <p className="text-11 text-slate-600 mb-4">Patterns passés au statut "Établi" depuis Optimisation — preuve réelle suffisamment confirmée, pas une simple hypothèse.</p>
          {etablis.length === 0 ? (
            <p className="text-slate-500 text-sm px-1">Aucun pattern validé pour l'instant — passe-le en "Établi" depuis Optimisation.</p>
          ) : (
            <div className="space-y-2">
              {etablis.map((item) => (
                <div key={item.id} className="p-3 rounded-xl bg-surface border border-emerald-500/20 group">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="text-10 text-slate-500 font-mono-data">{item.fieldLabel} · {item.projectNom}</span>
                      <p className="text-13 text-slate-300 leading-relaxed mt-1">{item.text}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <button onClick={() => onUpdateStatut(item.id, "À valider")} className="text-9 px-2 py-0.5 rounded-full border border-app text-slate-500 hover:text-amber-300 hover:border-amber-400/30">Rétrograder</button>
                      <button onClick={() => onRemove(item.id)} className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all"><Trash2 size={13} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
function CorbeilleView({ index, onRestoreProject, onSelectProject }) {
  const archived = index.filter((p) => p.archived).sort((a, b) => new Date(b.archivedDate || 0) - new Date(a.archivedDate || 0));
  return (
    <div className="max-w-2xl mx-auto px-5 py-6">
      <h2 className="font-display text-lg mb-1">Corbeille</h2>
      <p className="text-11 text-slate-600 mb-5">Les fiches supprimées restent ici, jamais effacées silencieusement — restaure en cas d'erreur.</p>
      {archived.length === 0 && <p className="text-slate-500 text-sm">Corbeille vide.</p>}
      <div className="space-y-2">
        {archived.map((p) => (
          <div key={p.id} className="p-3 rounded-xl bg-surface border border-app flex items-center justify-between gap-2">
            <button onClick={() => onSelectProject(p.id)} className="text-left min-w-0 flex-1">
              <p className="text-13 text-cream truncate">{p.nom}</p>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <span className="text-10 px-2 py-0.5 rounded-full border border-app text-slate-500">{p.categorie}</span>
                <span className="text-10 px-2 py-0.5 rounded-full border border-red-400/30 text-red-300">Supprimée{p.archivedDate ? ` — ${new Date(p.archivedDate).toLocaleDateString("fr-FR")}` : ""}</span>
              </div>
            </button>
            <button onClick={() => onRestoreProject(p.id)} className="text-11 px-2.5 py-1 rounded-full border border-app text-slate-400 hover:border-amber-400/30 hover:text-amber-300 shrink-0">Restaurer</button>
          </div>
        ))}
      </div>
    </div>
  );
}
// Onglet global "Suivi" — contact et étape commerciale de chaque projet actif,
// sans ouvrir la fiche complète. Chargement paresseux : le détail (contact,
// synthèse pour la proposition) n'est lu que quand une ligne est dépliée.
function SuiviView({ index, onFieldUpdate, onOpenProject, studioName, feedbackEmail, tarifSettings, initialStage = "Tous" }) {
  const [expandedId, setExpandedId] = useState(null);
  const [activeStage, setActiveStage] = useState(initialStage);
  const [loaded, setLoaded] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generatingProposal, setGeneratingProposal] = useState(false);
  const [copiedProposal, setCopiedProposal] = useState(false);
  const [copiedDevis, setCopiedDevis] = useState(false);
  const [devisMessage, setDevisMessage] = useState(null);
  const allProjects = index.filter((p) => !p.archived).sort((a, b) => new Date(b.date) - new Date(a.date));
  const projects = activeStage === "Tous" ? allProjects : allProjects.filter((p) => (p.pipeline || "Prospect") === activeStage);

  async function toggleExpand(id) {
    if (expandedId === id) { setExpandedId(null); setLoaded(null); return; }
    setExpandedId(id); setLoading(true); setLoaded(null);
    try { const r = await window.storage.get(`nandem-project:${id}`); setLoaded(r ? JSON.parse(r.value) : { id }); }
    catch { setLoaded({ id }); }
    setLoading(false);
  }
  async function updateLoadedField(patch) {
    setLoaded((prev) => ({ ...prev, ...patch }));
    await onFieldUpdate(expandedId, patch);
  }
  async function generateProposalHere() {
    if (!loaded?.discovery?.synthesis) return;
    setGeneratingProposal(true);
    try { const proposal = await buildProposal(loaded.discovery.synthesis, loaded.finance, studioName); await updateLoadedField({ proposal }); }
    catch { await updateLoadedField({ proposalError: "La génération a échoué." }); }
    setGeneratingProposal(false);
  }
  async function copyProposal() {
    try { if (!navigator.clipboard) throw new Error("indisponible"); await navigator.clipboard.writeText(loaded.proposal); setCopiedProposal(true); setTimeout(() => setCopiedProposal(false), 1800); } catch {}
  }
  async function prepareDevis() {
    if (!loaded?.discovery?.synthesis) { setDevisMessage("Termine d'abord le diagnostic : il fournit le besoin, le périmètre et la complexité du devis."); return; }
    const prix = loaded.devisDraft?.amount ?? loaded.finance?.devis ?? computeDevisPrice(loaded.discovery.synthesis.complexite, tarifSettings);
    const devisDraft = loaded.devisDraft || {
      id: `devis:${genId()}`, status: "Brouillon", amount: prix,
      content: buildDevisTemplate(loaded, prix, studioName, feedbackEmail), createdAt: new Date().toISOString(),
    };
    await updateLoadedField({ devisDraft, finance: { ...(loaded.finance || {}), devis: prix } });
    setDevisMessage("Brouillon créé et sauvegardé. Vérifie-le avant de l'envoyer au client.");
  }
  async function updateDevisContent(content) {
    await updateLoadedField({ devisDraft: { ...loaded.devisDraft, content, updatedAt: new Date().toISOString() } });
  }
  async function copyDevisDraft() {
    try { if (!navigator.clipboard) throw new Error("indisponible"); await navigator.clipboard.writeText(loaded.devisDraft.content); setCopiedDevis(true); setTimeout(() => setCopiedDevis(false), 1800); } catch { setDevisMessage("Copie automatique indisponible : sélectionne le texte du devis manuellement."); }
  }

  return (
    <div className="max-w-2xl mx-auto px-5 py-6">
      <h2 className="font-display text-lg mb-1">Suivi</h2>
      <p className="text-11 text-slate-600 mb-3">Choisis une étape pour afficher les projets concernés, puis déplie une fiche pour agir.</p>
      <div className="flex flex-wrap gap-1.5 mb-5">
        {["Tous", ...PIPELINE_STAGES].map((stage) => {
          const count = stage === "Tous" ? allProjects.length : allProjects.filter((p) => (p.pipeline || "Prospect") === stage).length;
          return <button key={stage} onClick={() => { setActiveStage(stage); setExpandedId(null); setLoaded(null); }} className={`text-11 px-2.5 py-1.5 rounded-full border transition-colors ${activeStage === stage ? "bg-amber-400 text-app border-amber-400" : "border-app text-slate-400"}`}>{stage} · {count}</button>;
        })}
      </div>
      {projects.length === 0 && <p className="text-slate-500 text-sm">Aucun projet actif pour l'instant.</p>}
      <div className="space-y-2">
        {projects.map((p) => (
          <div key={p.id} className="rounded-xl bg-surface border border-app overflow-hidden">
            <button onClick={() => toggleExpand(p.id)} className="w-full flex items-center justify-between gap-2 p-3">
              <div className="text-left min-w-0">
                <p className="text-13 text-cream truncate">{p.nom}</p>
                <span className="text-10 px-2 py-0.5 rounded-full border border-amber-400/20 text-amber-400/70 mt-1 inline-block">{p.pipeline || "Prospect"}</span>
              </div>
              <ChevronDown size={14} className={`text-slate-500 shrink-0 transition-transform ${expandedId === p.id ? "rotate-180" : ""}`} />
            </button>
            {expandedId === p.id && (
              <div className="px-3 pb-3">
                {loading ? <Loader2 size={16} className="animate-spin text-amber-400" /> : loaded && (
                  <>
                    <PipelineSection project={loaded} onUpdate={(pipeline) => updateLoadedField({ pipeline })} />
                    <ClientSection project={loaded} onUpdate={(client) => updateLoadedField({ client })} />
                    <div className="mb-5 p-4 rounded-xl bg-surface border border-app">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div><p className="text-11 uppercase tracking-wider text-slate-500">Devis client</p><p className="text-10 text-slate-600 mt-1">Prérempli sans IA, montant figé à sa création.</p></div>
                        {!loaded.devisDraft && <button onClick={prepareDevis} className="text-11 px-3 py-1.5 rounded-lg bg-amber-400 text-app flex items-center gap-1.5"><Receipt size={12} /> Préparer</button>}
                      </div>
                      {devisMessage && <p className="text-11 text-amber-300/80 mb-2">{devisMessage}</p>}
                      {loaded.devisDraft && (<>
                        <div className="flex items-center justify-between text-11 mb-2"><span className="text-emerald-300">Brouillon sauvegardé</span><span className="text-amber-300 font-mono-data">{loaded.devisDraft.amount} €</span></div>
                        <textarea value={loaded.devisDraft.content} onChange={(e) => setLoaded((prev) => ({ ...prev, devisDraft: { ...prev.devisDraft, content: e.target.value } }))} onBlur={(e) => updateDevisContent(e.target.value)} rows={14} className="w-full bg-surface-2 border border-app rounded-xl p-3 text-11 text-slate-300 font-mono-data" />
                        <button onClick={copyDevisDraft} className="w-full mt-2 py-2 rounded-lg bg-amber-400 text-app text-12 flex items-center justify-center gap-2">{copiedDevis ? <Check size={13} /> : <Copy size={13} />}{copiedDevis ? "Copié — prêt à envoyer" : "Copier le devis"}</button>
                      </>)}
                    </div>
                    {loaded.discovery?.synthesis && (
                      <div className="p-4 rounded-xl bg-surface-2 border border-app">
                        <p className="text-11 uppercase tracking-wider text-slate-500 mb-2">Proposition commerciale</p>
                        {!loaded.proposal && (<button onClick={generateProposalHere} disabled={generatingProposal} className="w-full py-2 rounded-lg bg-surface border border-app text-13 text-slate-300 flex items-center justify-center gap-2 disabled:opacity-50">{generatingProposal ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}{generatingProposal ? "Génération…" : "Générer la proposition"}</button>)}
                        {loaded.proposalError && <p className="text-11 text-red-300 mt-2">{loaded.proposalError}</p>}
                        {loaded.proposal && (<>
                          <div className="p-3 rounded-lg bg-surface border border-app-soft text-12 text-slate-300 whitespace-pre-line leading-relaxed mb-2">{loaded.proposal}</div>
                          <button onClick={copyProposal} className="w-full py-2 rounded-lg bg-amber-400 text-app text-12 flex items-center justify-center gap-2">{copiedProposal ? <Check size={13} /> : <Copy size={13} />}{copiedProposal ? "Copié" : "Copier la proposition"}</button>
                        </>)}
                      </div>
                    )}
                    <button onClick={() => onOpenProject(p.id)} className="w-full mt-3 py-2 text-12 text-slate-500 hover:text-amber-400 transition-colors">Ouvrir la fiche complète →</button>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
// Onglet global "Facturation" — suivi financier centralisé, avec totaux.
function FacturationView({ index, onFieldUpdate, tarifSettings, studioName, feedbackEmail, tarifHoraire }) {
  const [expandedId, setExpandedId] = useState(null);
  const [loaded, setLoaded] = useState(null);
  const [loading, setLoading] = useState(false);
  const [totals, setTotals] = useState(null);
  const [generatingDevis, setGeneratingDevis] = useState(false);
  const [copiedDevis, setCopiedDevis] = useState(false);
  const projects = index.filter((p) => !p.archived).sort((a, b) => new Date(b.date) - new Date(a.date));

  async function toggleExpand(id) {
    if (expandedId === id) { setExpandedId(null); setLoaded(null); return; }
    setExpandedId(id); setLoading(true); setLoaded(null);
    try { const r = await window.storage.get(`nandem-project:${id}`); setLoaded(r ? JSON.parse(r.value) : { id }); }
    catch { setLoaded({ id }); }
    setLoading(false);
  }
  async function updateLoadedField(patch) {
    setLoaded((prev) => ({ ...prev, ...patch }));
    await onFieldUpdate(expandedId, patch);
  }
  async function generateDevisHere() {
    if (!loaded?.discovery?.synthesis) return;
    setGeneratingDevis(true);
    const prix = computeDevisPrice(loaded.discovery.synthesis.complexite, tarifSettings);
    try {
      const devisText = await buildDevis(loaded.discovery.synthesis, prix, studioName, feedbackEmail);
      await updateLoadedField({ devisText, devisTextError: null, finance: { ...(loaded.finance || {}), devis: prix } });
    } catch {
      await updateLoadedField({ devisTextError: "La génération a échoué." });
    }
    setGeneratingDevis(false);
  }
  async function copyDevis() {
    try { if (!navigator.clipboard) throw new Error("indisponible"); await navigator.clipboard.writeText(loaded.devisText); setCopiedDevis(true); setTimeout(() => setCopiedDevis(false), 1800); } catch {}
  }
  // Calcule les totaux à la demande (lit chaque fiche) — pas de duplication
  // de la vérité financière dans l'index, juste un résumé recalculé.
  async function computeTotals() {
    setTotals({ loading: true });
    let devis = 0, paye = 0, count = 0;
    for (const p of projects) {
      try {
        const r = await window.storage.get(`nandem-project:${p.id}`);
        if (r) { const full = JSON.parse(r.value); if (full.finance?.devis != null || full.finance?.paye != null) { devis += full.finance.devis || 0; paye += full.finance.paye || 0; count++; } }
      } catch {}
    }
    setTotals({ loading: false, devis, paye, count });
  }

  return (
    <div className="max-w-2xl mx-auto px-5 py-6">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h2 className="font-display text-lg">Facturation</h2>
        <button onClick={computeTotals} disabled={totals?.loading} className="text-11 px-3 py-1.5 rounded-full bg-amber-400 text-app disabled:opacity-50 flex items-center gap-1.5">{totals?.loading ? <Loader2 size={12} className="animate-spin" /> : <Receipt size={12} />} Calculer les totaux</button>
      </div>
      <p className="text-11 text-slate-600 mb-3">Déplie une ligne pour voir/modifier les montants, ou générer un devis complet chiffré.</p>
      {totals && !totals.loading && (
        <div className="grid grid-cols-3 gap-2 mb-5">
          <div className="p-3 rounded-xl bg-surface border border-app text-center"><p className="text-lg font-display text-amber-400">{totals.devis} €</p><p className="text-10 text-slate-500 mt-1">Devis cumulés</p></div>
          <div className="p-3 rounded-xl bg-surface border border-app text-center"><p className="text-lg font-display text-amber-400">{totals.paye} €</p><p className="text-10 text-slate-500 mt-1">Encaissé</p></div>
          <div className="p-3 rounded-xl bg-surface border border-app text-center"><p className="text-lg font-display text-amber-400">{totals.devis - totals.paye} €</p><p className="text-10 text-slate-500 mt-1">Reste dû</p></div>
        </div>
      )}
      {projects.length === 0 && <p className="text-slate-500 text-sm">Aucun projet actif pour l'instant.</p>}
      <div className="space-y-2">
        {projects.map((p) => (
          <div key={p.id} className="rounded-xl bg-surface border border-app overflow-hidden">
            <button onClick={() => toggleExpand(p.id)} className="w-full flex items-center justify-between gap-2 p-3">
              <p className="text-13 text-cream truncate">{p.nom}</p>
              <ChevronDown size={14} className={`text-slate-500 shrink-0 transition-transform ${expandedId === p.id ? "rotate-180" : ""}`} />
            </button>
            {expandedId === p.id && (
              <div className="px-3 pb-3">
                {loading ? <Loader2 size={16} className="animate-spin text-amber-400" /> : loaded && (
                  <>
                    <FinanceSection project={loaded} onUpdateProject={updateLoadedField} studioName={studioName} feedbackEmail={feedbackEmail} tarifHoraire={tarifHoraire} />
                    {loaded.discovery?.synthesis ? (
                      <div className="p-4 rounded-xl bg-surface-2 border border-app">
                        <p className="text-11 uppercase tracking-wider text-slate-500 mb-1">Devis complet</p>
                        <p className="text-10 text-slate-600 mb-2">Prix calculé selon la complexité ({loaded.discovery.synthesis.complexite || "non renseignée"}) et tes tarifs réglés dans Réglages — jamais en dessous de {PRIX_MINIMUM} €.</p>
                        <button onClick={generateDevisHere} disabled={generatingDevis} className="w-full py-2 rounded-lg bg-surface border border-app text-13 text-slate-300 flex items-center justify-center gap-2 disabled:opacity-50">{generatingDevis ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}{generatingDevis ? "Génération…" : loaded.devisText ? "Régénérer le devis" : "Générer le devis complet"}</button>
                        {loaded.devisTextError && <p className="text-11 text-red-300 mt-2">{loaded.devisTextError}</p>}
                        {loaded.devisText && (<>
                          <div className="p-3 mt-2 rounded-lg bg-surface border border-app-soft text-12 text-slate-300 whitespace-pre-line leading-relaxed">{loaded.devisText}</div>
                          <button onClick={copyDevis} className="w-full mt-2 py-2 rounded-lg bg-amber-400 text-app text-12 flex items-center justify-center gap-2">{copiedDevis ? <Check size={13} /> : <Copy size={13} />}{copiedDevis ? "Copié — colle-le dans ton mail" : "Copier le devis"}</button>
                        </>)}
                      </div>
                    ) : (
                      <p className="text-11 text-slate-600">Diagnostic pas encore terminé pour ce projet — le devis a besoin d'une synthèse.</p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
// Onglet global "Bilan" — tableau de bord déterministe, aucun appel IA ici.
// Répartition par étape commerciale (lue depuis l'index, instantané), "à
// traiter" calculé par règles simples, finances cumulées sur demande (lecture
// de chaque fiche, comme dans Facturation).
function BilanView({ index, onOpenProject, onOpenStage, onSuggestBusiness, onAcceptProposal }) {
  const [finance, setFinance] = useState(null);
  const [businessScanning, setBusinessScanning] = useState(false);
  const [businessProposals, setBusinessProposals] = useState([]);
  const [businessScanMessage, setBusinessScanMessage] = useState(null);
  async function scanBusiness() {
    setBusinessScanning(true); setBusinessScanMessage(null);
    const proposals = await onSuggestBusiness();
    setBusinessProposals(proposals);
    setBusinessScanning(false);
    if (!proposals.length) setBusinessScanMessage("Pas assez de données pour une piste utile pour l'instant.");
  }
  const active = index.filter((p) => !p.archived);
  const stageCounts = {};
  PIPELINE_STAGES.forEach((s) => { stageCounts[s] = 0; });
  active.forEach((p) => { const s = p.pipeline || "Prospect"; stageCounts[s] = (stageCounts[s] || 0) + 1; });

  const aTraiter = [
    ...active.filter((p) => (p.pipeline || "Prospect") === "Devis envoyé").map((p) => ({ id: p.id, nom: p.nom, raison: "Devis envoyé — en attente de réponse, penser à relancer" })),
    ...active.filter((p) => ["Signé", "En cours"].includes(p.pipeline) && p.hasDiscovery && !p.hasConception).map((p) => ({ id: p.id, nom: p.nom, raison: "Signé mais la conception technique n'est pas encore générée" })),
    ...active.filter((p) => !p.hasDiscovery).map((p) => ({ id: p.id, nom: p.nom, raison: "Diagnostic pas encore commencé" })),
  ];

  async function computeFinance() {
    setFinance({ loading: true });
    let devis = 0, paye = 0;
    for (const p of active) {
      try {
        const r = await window.storage.get(`nandem-project:${p.id}`);
        if (r) { const full = JSON.parse(r.value); devis += full.finance?.devis || 0; paye += full.finance?.paye || 0; }
      } catch {}
    }
    setFinance({ loading: false, devis, paye });
  }

  return (
    <div className="max-w-2xl mx-auto px-5 py-6">
      <h2 className="font-display text-lg mb-1">Bilan</h2>
      <p className="text-11 text-slate-600 mb-5">Vue d'ensemble — répartition commerciale, finances, ce qui attend une action. Aucun calcul IA ici, juste des chiffres.</p>

      <p className="text-11 uppercase tracking-wider text-slate-500 mb-2">Répartition par étape</p>
      <div className="grid grid-cols-2 gap-2 mb-6">
        {PIPELINE_STAGES.map((s) => (
          <button key={s} onClick={() => onOpenStage(s)} className="p-3 rounded-xl bg-surface border border-app text-left hover:border-amber-400/30 transition-colors" aria-label={`Voir les projets : ${s}`}>
            <p className="text-xl font-display text-amber-400">{stageCounts[s]}</p>
            <p className="text-10 text-slate-500 mt-0.5">{s}</p>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between mb-2">
        <p className="text-11 uppercase tracking-wider text-slate-500">Finances cumulées</p>
        <button onClick={computeFinance} disabled={finance?.loading} className="text-11 px-3 py-1.5 rounded-full bg-amber-400 text-app disabled:opacity-50 flex items-center gap-1.5">{finance?.loading ? <Loader2 size={12} className="animate-spin" /> : <Receipt size={12} />} Calculer</button>
      </div>
      {finance && !finance.loading ? (
        <div className="grid grid-cols-3 gap-2 mb-6">
          <div className="p-3 rounded-xl bg-surface border border-app text-center"><p className="text-lg font-display text-amber-400">{finance.devis} €</p><p className="text-10 text-slate-500 mt-1">Devis cumulés</p></div>
          <div className="p-3 rounded-xl bg-surface border border-app text-center"><p className="text-lg font-display text-amber-400">{finance.paye} €</p><p className="text-10 text-slate-500 mt-1">Encaissé</p></div>
          <div className="p-3 rounded-xl bg-surface border border-app text-center"><p className="text-lg font-display text-amber-400">{finance.devis - finance.paye} €</p><p className="text-10 text-slate-500 mt-1">Reste dû</p></div>
        </div>
      ) : (<p className="text-11 text-slate-600 mb-6">Pas encore calculé.</p>)}

      <div className="mb-6 p-4 rounded-xl bg-surface border border-app">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <p className="text-11 uppercase tracking-wider text-slate-500">Suggestions pour optimiser le business</p>
          <button onClick={scanBusiness} disabled={businessScanning} className="flex items-center gap-1.5 text-11 px-2.5 py-1.5 rounded-full bg-amber-400 text-app disabled:opacity-50">{businessScanning ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />} Analyser mon activité</button>
        </div>
        <p className="text-10 text-slate-600 mb-2">Basé sur un résumé chiffré (répartition commerciale, finances, patterns validés) — jamais les détails d'un projet précis. Niveau de confiance toujours Hypothèse, jamais plus, vu la quantité de données.</p>
        {businessScanMessage && <p className="text-11 text-amber-400/70 mb-2">{businessScanMessage}</p>}
        {businessProposals.length > 0 && (
          <div className="space-y-2">
            {businessProposals.map((p, i) => (
              <div key={i} className="p-3 rounded-xl bg-violet-400/5 border border-violet-400/20">
                <p className="text-13 text-cream font-medium">{p.label}</p>
                <p className="text-12 text-slate-400 mt-1">{p.description}</p>
                <p className="text-10 text-slate-600 mt-1.5 font-mono-data">{p.niveauConfiance}</p>
                <div className="flex gap-2 mt-2.5">
                  <button onClick={() => { onAcceptProposal(p); setBusinessProposals(businessProposals.filter((_, idx) => idx !== i)); }} className="text-11 px-2.5 py-1 rounded-full bg-amber-400 text-app">Garder dans Optimisation</button>
                  <button onClick={() => setBusinessProposals(businessProposals.filter((_, idx) => idx !== i))} className="text-11 px-2.5 py-1 rounded-full border border-app text-slate-500">Ignorer</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-11 uppercase tracking-wider text-slate-500 mb-2">À traiter</p>
      {aTraiter.length === 0 ? (
        <p className="text-slate-500 text-sm">Rien à signaler.</p>
      ) : (
        <div className="space-y-2">
          {aTraiter.map((item, i) => (
            <button key={`${item.id}-${i}`} onClick={() => onOpenProject(item.id)} className="w-full text-left p-3 rounded-xl bg-surface border border-app hover:border-amber-400/30 transition-colors">
              <p className="text-13 text-cream">{item.nom}</p>
              <p className="text-11 text-slate-500 mt-0.5">{item.raison}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
function AdminApp({ theme, setTheme }) {
  const themeClass = theme === "light" ? "theme-light" : "theme-dark";
  const [tab, setTab] = useState("projets");
  const [suiviInitialStage, setSuiviInitialStage] = useState("Tous");
  const [index, setIndex] = useState([]);
  const [visibleCount, setVisibleCount] = useState(PROJECTS_PAGE_SIZE);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [loadingSelected, setLoadingSelected] = useState(false);
  const [library, setLibrary] = useState([]);
  const [clientSubmissions, setClientSubmissions] = useState([]);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("Entreprise");
  const [pickerFor, setPickerFor] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [clientLinkFallback, setClientLinkFallback] = useState(null);
  const [settings, setSettings] = useState({ studioName: PLACEHOLDER_STUDIO, feedbackEmail: PLACEHOLDER_EMAIL, aiProvider: "anthropic" });
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [customGoals, setCustomGoals] = useState([]);
  const [apiKey, setApiKeyState] = useState(null);
  // Clé du fournisseur "custom" (API compatible OpenAI, 27/08/2026) — gardée
  // séparée des réglages publics comme la clé Anthropic, même raison : ne
  // jamais finir dans un export/JSON qui pourrait circuler.
  const [customAiKey, setCustomAiKeyState] = useState(null);
  const [promptAddendum, setPromptAddendum] = useState("");
  const [promptFeedback, setPromptFeedback] = useState([]);
  const [mdImportAddendum, setMdImportAddendum] = useState("");
  const [engineRequirements, setEngineRequirements] = useState([]);
  const [questionOverrides, setQuestionOverrides] = useState([]);

  useEffect(() => { (async () => {
    try { const p = await window.storage.get("nandem-project-index"); setIndex(p ? JSON.parse(p.value) : []); } catch { setIndex([]); }
    try { const l = await window.storage.get("nandem-library"); setLibrary(l ? JSON.parse(l.value) : []); } catch { setLibrary([]); }
    try { const cs = await window.storage.get("nandem-client-submissions", true); setClientSubmissions(cs ? JSON.parse(cs.value) : []); } catch { setClientSubmissions([]); }
    // Le fournisseur IA (Anthropic/LM Studio/custom) est chargé ici avec le
    // reste des réglages publics, puis répercuté sur la variable module-level
    // AI_PROVIDER (27/08/2026) — sans ça, callAnthropic() ne saurait pas quel
    // en-tête envoyer au relais après un rechargement de page. La clé
    // "custom" (secrète) est chargée juste après, séparément, puis les deux
    // sont recombinées dans setCustomAiConfig().
    let loadedCustomKey = null;
    try { const st = await window.storage.get("nandem-public-settings", true); if (st) { const parsed = JSON.parse(st.value); setSettings(parsed); setAiProvider(parsed.aiProvider); } } catch {}
    try { const seen = await window.storage.get("nandem-onboarding-seen"); if (!seen) setShowOnboarding(true); } catch { setShowOnboarding(true); }
    try { const cg = await window.storage.get("nandem-custom-goals"); setCustomGoals(cg ? JSON.parse(cg.value) : []); } catch { setCustomGoals([]); }
    try { const ak = await window.storage.get("nandem-api-key"); if (ak?.value) { setApiKeyState(ak.value); setAnthropicApiKey(ak.value); } } catch {}
    try { const cak = await window.storage.get("nandem-custom-ai-key"); if (cak?.value) { loadedCustomKey = cak.value; setCustomAiKeyState(cak.value); } } catch {}
    try { const st2 = await window.storage.get("nandem-public-settings", true); const parsed2 = st2 ? JSON.parse(st2.value) : {}; setCustomAiConfig({ baseUrl: parsed2.customAiBaseUrl, model: parsed2.customAiModel, apiKey: loadedCustomKey }); } catch {}
    try { const pa = await window.storage.get("nandem-prompt-addendum"); if (pa?.value) setPromptAddendum(pa.value); } catch {}
    try { const pf = await window.storage.get("nandem-prompt-feedback"); setPromptFeedback(pf ? JSON.parse(pf.value) : []); } catch { setPromptFeedback([]); }
    try { const ma = await window.storage.get("nandem-md-import-addendum"); if (ma?.value) setMdImportAddendum(ma.value); } catch {}
    try { const er = await window.storage.get("nandem-engine-requirements"); const merged = mergeDefaultEngineRequirements(er ? JSON.parse(er.value) : []); setEngineRequirements(merged); await window.storage.set("nandem-engine-requirements", JSON.stringify(merged)); } catch { setEngineRequirements(DEFAULT_ENGINE_REQUIREMENTS); }
    try { const qo = await window.storage.get("nandem-question-overrides"); setQuestionOverrides(qo ? JSON.parse(qo.value) : []); } catch { setQuestionOverrides([]); }
    setLoaded(true);
  })(); }, []);

  useEffect(() => { if (!selectedId) { setSelectedProject(null); return; }
    setLoadingSelected(true);
    (async () => { try { const r = await window.storage.get(`nandem-project:${selectedId}`); setSelectedProject(r ? JSON.parse(r.value) : null); } catch { setSelectedProject(null); } setLoadingSelected(false); })();
  }, [selectedId]);

  async function persistIndex(next) { setIndex(next); try { await window.storage.set("nandem-project-index", JSON.stringify(next)); } catch {} }
  async function persistLibrary(next) { setLibrary(next); try { await window.storage.set("nandem-library", JSON.stringify(next)); } catch {} }
  async function persistClientSubmissions(next) { setClientSubmissions(next); await window.storage.set("nandem-client-submissions", JSON.stringify(next), true); }
  async function refreshClientSubmissions() {
    try { const cs = await window.storage.get("nandem-client-submissions", true); setClientSubmissions(cs ? JSON.parse(cs.value) : []); } catch { setClientSubmissions([]); }
  }
  async function persistEngineRequirements(next) { setEngineRequirements(next); try { await window.storage.set("nandem-engine-requirements", JSON.stringify(next)); } catch {} }
  async function persistQuestionOverrides(next) { setQuestionOverrides(next); try { await window.storage.set("nandem-question-overrides", JSON.stringify(next)); } catch {} }

  async function analyzeQuestionnairesForApp() {
    const eligible = index.filter((project) => project.hasDiscovery && !project.archived).slice(0, 30);
    if (eligible.length < 2) return { proposals: [], message: `Il faut au moins 2 questionnaires terminés (${eligible.length} disponible${eligible.length > 1 ? "s" : ""}).` };
    const samples = [];
    for (const summary of eligible) {
      try {
        const stored = await window.storage.get(`nandem-project:${summary.id}`);
        if (!stored) continue;
        const project = JSON.parse(stored.value);
        const family = questionnaireFamily(project.categorie);
        const answers = {};
        Object.entries(project.discovery?.answers || {}).forEach(([goalId, answer]) => {
          if (!answer?.text) return;
          answers[goalId] = { text: sanitizeQuestionnaireText(answer.text), state: answer.state || "inconnu", confidence: Number(answer.confidence) || 0 };
        });
        // Conversation brute assainie, en plus des réponses finales : une
        // question qui déclenche souvent une relance de l'IA (visible dans
        // l'ordre des échanges) est un signal de friction que la réponse
        // finale, déjà nettoyée, ne montre jamais.
        const conversation = (project.conversation || [])
          .slice(0, 60)
          .map((m) => ({ role: m.role === "user" ? "personne" : "moteur", text: sanitizeQuestionnaireText(m.text).slice(0, 400) }));
        samples.push({ questionnaire: family, answers, conversation });
      } catch {}
    }
    if (samples.length < 2) return { proposals: [], message: "Les questionnaires enregistrés n’ont pas pu être chargés en nombre suffisant." };
    const goalsByFamily = {
      app: applyQuestionOverrides([...GOALS_APP, ...customGoals], "App", questionOverrides).map(({ id, label, question }) => ({ id, label, question })),
      entreprise: applyQuestionOverrides([...GOALS_ENTREPRISE, ...customGoals], "Entreprise", questionOverrides).map(({ id, label, question }) => ({ id, label, question })),
    };
    const proposals = await analyzeQuestionnaireAnswers(samples, goalsByFamily);
    return { proposals, message: proposals.length ? `${samples.length} questionnaires analysés. ${proposals.length} amélioration(s) à examiner.` : `Aucun problème récurrent suffisamment clair sur les ${samples.length} questionnaires analysés.` };
  }

  function acceptQuestionImprovement(proposal) {
    const previous = questionOverrides.find((item) => item.goalId === proposal.goalId && item.questionnaire === proposal.questionnaire);
    const updated = {
      goalId: proposal.goalId, questionnaire: proposal.questionnaire, label: proposal.label,
      question: proposal.questionProposee, version: (previous?.version || 0) + 1,
      reason: proposal.probleme, evidence: proposal.preuves, confidence: proposal.niveauConfiance,
      history: [...(previous?.history || []), ...(previous ? [{ version: previous.version, question: previous.question, replacedAt: new Date().toISOString() }] : [])],
      updatedAt: new Date().toISOString(), status: "validé",
    };
    persistQuestionOverrides(previous ? questionOverrides.map((item) => item === previous ? updated : item) : [updated, ...questionOverrides]);
  }
  function revertQuestionImprovement(goalId, questionnaire) {
    persistQuestionOverrides(questionOverrides.filter((item) => !(item.goalId === goalId && item.questionnaire === questionnaire)));
  }

  function importEngineRequirements(jsonText) {
    const parsed = JSON.parse(jsonText);
    const incoming = Array.isArray(parsed) ? parsed : (parsed.requirements || parsed.patterns);
    if (!Array.isArray(incoming)) throw new Error('Le fichier doit contenir un tableau "requirements" ou "patterns".');
    const validScopes = new Set(["a_classer", "universel", "categorie", "famille", "secteur", "specifique"]);
    const byId = new Map(engineRequirements.map((r) => [r.id, r]));
    let added = 0; let updated = 0; let rejected = 0;
    incoming.forEach((raw) => {
      if (!raw || typeof raw.id !== "string" || !raw.id.trim() || typeof raw.label !== "string" || typeof raw.instruction !== "string") { rejected += 1; return; }
      const rawScope = typeof raw.portee === "object" ? raw.portee.niveau : raw.portee;
      const scope = validScopes.has(rawScope) ? rawScope : "a_classer";
      const normalized = {
        id: raw.id.trim(), version: Number(raw.version) || 1, label: raw.label.trim(), famille: raw.famille || "général",
        portee: { niveau: scope, cible: String((typeof raw.portee === "object" ? raw.portee.cible : raw.cible) || "").trim() }, statut: ["Hypothèse", "Prometteur", "Établi"].includes(raw.statut) ? raw.statut : "Hypothèse",
        priorite: Math.min(5, Math.max(1, Number(raw.priorite) || 3)),
        declencheurs: Array.isArray(raw.declencheurs) ? raw.declencheurs.filter(Boolean).map(String) : [],
        exclusions: Array.isArray(raw.exclusions) ? raw.exclusions.filter(Boolean).map(String) : [],
        instruction: raw.instruction.trim(), questions: Array.isArray(raw.questions) ? raw.questions.filter(Boolean).map(String) : [],
        tests: Array.isArray(raw.tests) ? raw.tests.filter(Boolean).map(String) : [],
        preuves: { projetsFictifs: Number(raw.preuves?.projetsFictifs) || 0, projetsReels: Number(raw.preuves?.projetsReels) || 0, bugsConfirmes: Number(raw.preuves?.bugsConfirmes) || 0, contreExemples: Number(raw.preuves?.contreExemples) || 0 },
        importedAt: new Date().toISOString(),
      };
      if (byId.has(normalized.id)) updated += 1; else added += 1;
      byId.set(normalized.id, normalized);
    });
    persistEngineRequirements(Array.from(byId.values()));
    if (parsed && !Array.isArray(parsed) && typeof parsed.universalRules === "string") {
      setPromptAddendum(parsed.universalRules);
      window.storage.set("nandem-prompt-addendum", parsed.universalRules).catch(() => {});
    }
    let observationsAdded = 0;
    if (Array.isArray(parsed?.observations)) {
      const observationMap = new Map(library.map((item) => [item.id, item]));
      parsed.observations.forEach((item) => {
        if (!item || typeof item.id !== "string" || typeof item.text !== "string" || !item.text.trim()) return;
        if (!observationMap.has(item.id)) observationsAdded += 1;
        observationMap.set(item.id, item);
      });
      persistLibrary(Array.from(observationMap.values()));
    }
    return { added, updated, rejected, observationsAdded };
  }
  function updateEngineRequirement(id, patch) {
    persistEngineRequirements(engineRequirements.map((r) => (r.id === id ? { ...r, ...patch, updatedAt: new Date().toISOString() } : r)));
  }
  async function analyzeObservationsForFormalization() { return await synthesizeObservedPatterns(library); }
  function acceptFormalizedRequirement(proposal) {
    const scope = ["universel", "categorie", "famille", "secteur", "specifique"].includes(proposal.porteeSuggeree) ? proposal.porteeSuggeree : "a_classer";
    const linkedIds = Array.isArray(proposal.observationsLiees) ? proposal.observationsLiees.filter((id) => typeof id === "string") : [];
    const linked = linkedIds.map((id) => library.find((item) => item.id === id)).filter(Boolean);
    const uniqueProjects = new Map(linked.map((item) => [item.projectId || item.projectNom || item.id, item]));
    const evidence = Array.from(uniqueProjects.values()).reduce((acc, item) => {
      const isFictitious = item.projectId === "observation-importee" || /fictif/i.test(`${item.projectNom || ""} ${item.source || ""}`);
      acc[isFictitious ? "projetsFictifs" : "projetsReels"] += 1;
      return acc;
    }, { projetsFictifs: 0, projetsReels: 0, bugsConfirmes: 0, contreExemples: 0 });
    const label = String(proposal.label || "Exigence formalisée").trim();
    const instruction = String(proposal.instruction || proposal.synthese || "").trim();
    if (!instruction) throw new Error("Une exigence doit contenir une instruction exploitable.");
    const signature = normalizedWords(`${label} ${instruction}`).sort().join("|");
    const existing = engineRequirements.find((item) => item.signature === signature || normalizedWords(`${item.label} ${item.instruction}`).sort().join("|") === signature);
    const requirement = {
      id: existing?.id || `requirement:${genId()}`, version: (existing?.version || 0) + 1, label, famille: proposal.cibleSuggeree || existing?.famille || "à préciser", signature,
      portee: { niveau: scope, cible: proposal.cibleSuggeree || "" }, statut: proposal.niveauConfiance || "Hypothèse", priorite: 3,
      declencheurs: Array.isArray(proposal.declencheurs) ? proposal.declencheurs : [], exclusions: Array.isArray(proposal.exclusions) ? proposal.exclusions : [],
      instruction, questions: Array.isArray(proposal.questions) ? proposal.questions : [], tests: Array.isArray(proposal.tests) ? proposal.tests : [],
      justification: proposal.justification || "", observationsLiees: Array.from(new Set([...(existing?.observationsLiees || []), ...linkedIds])),
      preuves: { projetsFictifs: Math.max(existing?.preuves?.projetsFictifs || 0, evidence.projetsFictifs), projetsReels: Math.max(existing?.preuves?.projetsReels || 0, evidence.projetsReels), bugsConfirmes: existing?.preuves?.bugsConfirmes || 0, contreExemples: existing?.preuves?.contreExemples || 0 }, importedAt: existing?.importedAt || new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    persistEngineRequirements(existing ? engineRequirements.map((item) => item.id === existing.id ? requirement : item) : [requirement, ...engineRequirements]);
  }
  async function persistFullProject(project) { setSelectedProject(project); try { await window.storage.set(`nandem-project:${project.id}`, JSON.stringify(project)); } catch {} }
  async function saveSettings(next) {
    setSettings(next);
    setAiProvider(next.aiProvider); // appliqué immédiatement, sans rechargement (27/08/2026)
    setCustomAiConfig({ baseUrl: next.customAiBaseUrl, model: next.customAiModel, apiKey: customAiKey });
    try { await window.storage.set("nandem-public-settings", JSON.stringify(next), true); } catch {}
  }
  // Clé du fournisseur "custom" (27/08/2026), même logique que saveApiKey :
  // stockée à part, jamais dans nandem-public-settings ni dans un export.
  async function saveCustomAiKey(key) {
    setCustomAiKeyState(key || null);
    setCustomAiConfig({ baseUrl: settings.customAiBaseUrl, model: settings.customAiModel, apiKey: key || null });
    try { key ? await window.storage.set("nandem-custom-ai-key", key) : await window.storage.delete("nandem-custom-ai-key"); } catch {}
  }
  async function saveApiKey(key) {
    setApiKeyState(key || null);
    setAnthropicApiKey(key || null);
    try { key ? await window.storage.set("nandem-api-key", key) : await window.storage.delete("nandem-api-key"); } catch {}
  }
  async function savePromptFeedback(projectNom, text) {
    if (!text.trim()) return;
    const entry = { id: genId(), projectNom, text: text.trim(), date: new Date().toISOString(), promoted: false };
    const next = [entry, ...promptFeedback];
    setPromptFeedback(next);
    try { await window.storage.set("nandem-prompt-feedback", JSON.stringify(next)); } catch {}
  }
  async function promotePromptFeedback(entryId) {
    const entry = promptFeedback.find((f) => f.id === entryId);
    if (!entry) return;
    const nextAddendum = promptAddendum ? `${promptAddendum}\n- ${entry.text}` : `- ${entry.text}`;
    setPromptAddendum(nextAddendum);
    const next = promptFeedback.map((f) => (f.id === entryId ? { ...f, promoted: true } : f));
    setPromptFeedback(next);
    try {
      await window.storage.set("nandem-prompt-addendum", nextAddendum);
      await window.storage.set("nandem-prompt-feedback", JSON.stringify(next));
    } catch {}
  }
  async function dismissPromptFeedback(entryId) {
    const next = promptFeedback.filter((f) => f.id !== entryId);
    setPromptFeedback(next);
    try { await window.storage.set("nandem-prompt-feedback", JSON.stringify(next)); } catch {}
  }
  async function promoteSynthesizedLesson(text) {
    const nextAddendum = promptAddendum ? `${promptAddendum}\n- ${text}` : `- ${text}`;
    setPromptAddendum(nextAddendum);
    try { await window.storage.set("nandem-prompt-addendum", nextAddendum); } catch {}
  }
  async function promoteMdAddendum(text) {
    const nextAddendum = mdImportAddendum ? `${mdImportAddendum}\n- ${text}` : `- ${text}`;
    setMdImportAddendum(nextAddendum);
    try { await window.storage.set("nandem-md-import-addendum", nextAddendum); } catch {}
  }
  async function finishOnboarding() { setShowOnboarding(false); try { await window.storage.set("nandem-onboarding-seen", "true"); } catch {} }
  // Sauvegarde complète — tout ce que la bêta a appris (projets, bibliothèque,
  // prompts affinés, réglages) dans un seul objet, pour ne rien perdre au
  // moment d'un vrai déploiement. window.storage ne survit pas à une
  // migration vers un backend réel ; ceci est le pont manuel entre les deux.
  async function exportEverything() {
    const data = { version: "nandem-core-v1.5", exportedAt: new Date().toISOString() };
    try { const idx = await window.storage.get("nandem-project-index"); data.index = idx ? JSON.parse(idx.value) : []; } catch { data.index = []; }
    data.projects = {};
    for (const p of data.index) {
      try { const r = await window.storage.get(`nandem-project:${p.id}`); if (r) data.projects[p.id] = JSON.parse(r.value); } catch {}
    }
    try { const l = await window.storage.get("nandem-library"); data.library = l ? JSON.parse(l.value) : []; } catch { data.library = []; }
    try { const cg = await window.storage.get("nandem-custom-goals"); data.customGoals = cg ? JSON.parse(cg.value) : []; } catch { data.customGoals = []; }
    try { const pa = await window.storage.get("nandem-prompt-addendum"); data.promptAddendum = pa?.value || ""; } catch { data.promptAddendum = ""; }
    try { const pf = await window.storage.get("nandem-prompt-feedback"); data.promptFeedback = pf ? JSON.parse(pf.value) : []; } catch { data.promptFeedback = []; }
    try { const ma = await window.storage.get("nandem-md-import-addendum"); data.mdImportAddendum = ma?.value || ""; } catch { data.mdImportAddendum = ""; }
    try { const er = await window.storage.get("nandem-engine-requirements"); data.engineRequirements = er ? JSON.parse(er.value) : []; } catch { data.engineRequirements = []; }
    try { const qo = await window.storage.get("nandem-question-overrides"); data.questionOverrides = qo ? JSON.parse(qo.value) : []; } catch { data.questionOverrides = []; }
    try { const cs = await window.storage.get("nandem-client-submissions", true); data.clientSubmissions = cs ? JSON.parse(cs.value) : []; } catch { data.clientSubmissions = []; }
    try { const vh = await window.storage.get("nandem-verification-history"); data.verificationHistory = vh ? JSON.parse(vh.value) : []; } catch { data.verificationHistory = []; }
    try { const st = await window.storage.get("nandem-public-settings", true); data.settings = st ? JSON.parse(st.value) : settings; } catch { data.settings = settings; }
    return JSON.stringify(data, null, 2);
  }
  // Remplace les données actuelles par celles de la sauvegarde — destructif,
  // volontairement pas de fusion silencieuse. L'appelant demande confirmation.
  async function importEverything(jsonText) {
    const data = JSON.parse(jsonText);
    if (data.index) await persistIndex(data.index);
    if (data.projects) { for (const [id, proj] of Object.entries(data.projects)) { await window.storage.set(`nandem-project:${id}`, JSON.stringify(proj)); } }
    if (data.library) await persistLibrary(data.library);
    if (data.customGoals) { setCustomGoals(data.customGoals); await window.storage.set("nandem-custom-goals", JSON.stringify(data.customGoals)); }
    if (data.promptAddendum != null) { setPromptAddendum(data.promptAddendum); await window.storage.set("nandem-prompt-addendum", data.promptAddendum); }
    if (data.promptFeedback) { setPromptFeedback(data.promptFeedback); await window.storage.set("nandem-prompt-feedback", JSON.stringify(data.promptFeedback)); }
    if (data.mdImportAddendum != null) { setMdImportAddendum(data.mdImportAddendum); await window.storage.set("nandem-md-import-addendum", data.mdImportAddendum); }
    if (data.engineRequirements) await persistEngineRequirements(data.engineRequirements);
    if (data.questionOverrides) await persistQuestionOverrides(data.questionOverrides);
    if (data.clientSubmissions) await persistClientSubmissions(data.clientSubmissions);
    if (data.verificationHistory) await window.storage.set("nandem-verification-history", JSON.stringify(data.verificationHistory));
    if (data.settings) { setSettings(data.settings); await window.storage.set("nandem-public-settings", JSON.stringify(data.settings), true); }
    if (selectedId) { try { const r = await window.storage.get(`nandem-project:${selectedId}`); setSelectedProject(r ? JSON.parse(r.value) : null); } catch {} }
  }

  const [creatingProject, setCreatingProject] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importName, setImportName] = useState("");
  const [importCategory, setImportCategory] = useState("Entreprise");
  const [importRaw, setImportRaw] = useState("");
  const [importMdOpen, setImportMdOpen] = useState(false);
  const [importMdName, setImportMdName] = useState("");
  const [importMdCategory, setImportMdCategory] = useState("Entreprise");
  const [importMdRaw, setImportMdRaw] = useState("");
  const [importingMd, setImportingMd] = useState(false);
  const [importBatchOpen, setImportBatchOpen] = useState(false);
  const [importBatchRaw, setImportBatchRaw] = useState("");
  const [importingBatch, setImportingBatch] = useState(false);
  const [importBatchResult, setImportBatchResult] = useState(null);
  // AJOUT (27/08/2026) : import direct d'une appli déjà construite via son
  // code .jsx — voir extractAppInfoFromCode plus haut.
  const [importJsxOpen, setImportJsxOpen] = useState(false);
  const [importJsxName, setImportJsxName] = useState("");
  const [importJsxCategory, setImportJsxCategory] = useState("Entreprise");
  const [importJsxRaw, setImportJsxRaw] = useState("");
  const [importingJsx, setImportingJsx] = useState(false);
  const [importJsxFileName, setImportJsxFileName] = useState("");
  const jsxFileInputRef = useRef(null);
  // AJOUT (27/08/2026) : sélection directe du fichier .jsx depuis le disque
  // (au lieu d'un copier-coller obligatoire) — lu en local dans le
  // navigateur via FileReader, jamais envoyé nulle part avant l'appel IA.
  function handleJsxFileChange(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImportJsxRaw(String(reader.result || ""));
      setImportJsxFileName(file.name);
      if (!importJsxName.trim()) setImportJsxName(file.name.replace(/\.[^./\\]+$/, ""));
    };
    reader.readAsText(file);
    e.target.value = "";
  }
  function openProjectEntry(entry) {
    setNewProjectOpen(entry === "new");
    setImportOpen(entry === "email");
    setImportMdOpen(entry === "markdown");
    setImportBatchOpen(entry === "batch");
    setImportJsxOpen(entry === "jsx");
    if (entry !== "batch") setImportBatchResult(null);
  }
  async function importClientEmail() {
    if (!importName.trim() || !importRaw.trim() || creatingProject) return;
    setCreatingProject(true);
    const id = genId();
    const answers = parseClientEmail(importRaw);
    const full = { id, nom: importName.trim(), categorie: importCategory, statut: "Exploration", entreprise: null, documents: [], conversation: [], date: new Date().toISOString(), discovery: { answers, synthesis: null, error: null }, conception: null };
    await persistFullProject(full);
    const detected = detectSectors(answers.secteur?.text || "");
    const secteurLabel = { sante: "Santé", juridique: "Juridique", enfance: "Enfance", finance: "Finance", public: "Service public" }[detected[0]] || "Général";
    await persistIndex([{ id, nom: full.nom, categorie: full.categorie, statut: full.statut, date: full.date, hasDiscovery: Object.keys(answers).length > 0, hasConception: false, secteurTag: secteurLabel }, ...index]);
    setCreatingProject(false);
    setImportName(""); setImportRaw(""); setImportOpen(false);
    setSelectedId(id);
  }
  // Import d'une idée déjà rédigée ailleurs (brainstorm avec une autre IA,
  // notes en Markdown...) — contrairement à l'email, le texte est libre, donc
  // le tri se fait par IA (extractFromDocuments gère déjà le cas texte seul).
  async function importMarkdownIdea() {
    if (!importMdName.trim() || !importMdRaw.trim() || importingMd) return;
    setImportingMd(true);
    const id = genId();
    const goalsForCategory = getGoalsFor(importMdCategory);
    const extracted = await extractAppInfoFromMarkdown(importMdRaw, goalsForCategory, mdImportAddendum);
    const answers = {};
    Object.entries(extracted || {}).forEach(([gid, val]) => {
      const g = goalsForCategory.find((x) => x.id === gid);
      if (g && val && String(val).trim()) answers[gid] = { text: String(val).trim(), confidence: 80, state: "confirme", label: g.label };
    });
    // Même correctif que pour l'import de documents : les questions
    // sectorielles (Confidentialité santé, Réglementation financière...)
    // n'existent qu'après détection du secteur — un premier passage seul ne
    // peut jamais les trouver, même si le texte source y répond déjà.
    const detectedSectors = detectSectors(answers.secteur?.text || "");
    const sectorGoals = detectedSectors.map((key) => SECTOR_EXTRA_GOALS[key]).filter(Boolean);
    if (sectorGoals.length) {
      const sectorExtracted = await extractAppInfoFromMarkdown(importMdRaw, sectorGoals, mdImportAddendum);
      Object.entries(sectorExtracted || {}).forEach(([gid, val]) => {
        const g = sectorGoals.find((x) => x.id === gid);
        if (g && val && String(val).trim()) answers[gid] = { text: String(val).trim(), confidence: 80, state: "confirme", label: g.label };
      });
    }
    const full = { id, nom: importMdName.trim(), categorie: importMdCategory, statut: "Exploration", entreprise: null, documents: [{ id: genId(), type: "note", text: importMdRaw, label: "Markdown importé (source)", date: new Date().toISOString() }], conversation: [], date: new Date().toISOString(), discovery: { answers, synthesis: null, error: null }, conception: null };
    await persistFullProject(full);
    const secteurLabel = { sante: "Santé", juridique: "Juridique", enfance: "Enfance", finance: "Finance", public: "Service public" }[detectedSectors[0]] || "Général";
    await persistIndex([{ id, nom: full.nom, categorie: full.categorie, statut: full.statut, date: full.date, hasDiscovery: Object.keys(answers).length > 0, hasConception: false, secteurTag: secteurLabel }, ...index]);
    setImportingMd(false);
    setImportMdName(""); setImportMdRaw(""); setImportMdOpen(false);
    setSelectedId(id);
  }
  // AJOUT (27/08/2026) : import direct d'une appli déjà construite à partir
  // de son fichier .jsx — même principe que importMarkdownIdea (IA déduit
  // les réponses du diagnostic), mais lit du code au lieu de texte libre, et
  // remplit EN PLUS "Code existant" (Mode Reprise) avec le code collé, pour
  // qu'une future itération sur ce projet ne reparte pas de zéro.
  async function importJsxApp() {
    if (!importJsxName.trim() || !importJsxRaw.trim() || importingJsx) return;
    setImportingJsx(true);
    const id = genId();
    const goalsForCategory = getGoalsFor(importJsxCategory);
    const extracted = await extractAppInfoFromCode(importJsxRaw, goalsForCategory);
    const answers = {};
    Object.entries(extracted || {}).forEach(([gid, val]) => {
      const g = goalsForCategory.find((x) => x.id === gid);
      if (g && val && String(val).trim()) answers[gid] = { text: String(val).trim(), confidence: 70, state: "confirme", label: g.label };
    });
    // Même correctif que pour l'import Markdown/documents : les questions
    // sectorielles n'existent qu'après détection du secteur — un premier
    // passage seul ne peut jamais les trouver.
    const detectedSectors = detectSectors(answers.secteur?.text || "");
    const sectorGoals = detectedSectors.map((key) => SECTOR_EXTRA_GOALS[key]).filter(Boolean);
    if (sectorGoals.length) {
      const sectorExtracted = await extractAppInfoFromCode(importJsxRaw, sectorGoals);
      Object.entries(sectorExtracted || {}).forEach(([gid, val]) => {
        const g = sectorGoals.find((x) => x.id === gid);
        if (g && val && String(val).trim()) answers[gid] = { text: String(val).trim(), confidence: 70, state: "confirme", label: g.label };
      });
    }
    // AJOUT (27/08/2026) : enchaînement direct synthèse + conception après
    // l'extraction du code, demandé par le porteur pour voir les patterns
    // détectés (Socle appliqué + exigences pertinentes) en un seul clic
    // plutôt que devoir enchaîner manuellement "Générer la synthèse" puis
    // "Générer la conception". Mêmes fonctions que le parcours manuel
    // (buildSynthesis, buildConception) — aucune duplication de logique.
    // Chaque étape reste résiliente : un échec IA sur la synthèse ou la
    // conception laisse quand même le projet créé avec ses réponses brutes,
    // au lieu de tout perdre — comme le fait déjà retrySynthesis ailleurs.
    let synthesis = null; let synthesisError = null;
    try { synthesis = await buildSynthesis(answers, []); }
    catch (e) { synthesisError = `La synthèse a échoué (${e.message}) — réponses conservées, réessayable depuis l'onglet Diagnostic.`; }
    let conception = null; let conceptionError = null;
    if (synthesis) {
      try { conception = await buildConception(synthesis, answers.ambiance?.text, null, null); }
      catch (e) { conceptionError = `La conception a échoué (${e.message}) — réessayable depuis l'onglet Conception.`; }
    }
    const full = {
      id, nom: importJsxName.trim(), categorie: importJsxCategory, statut: "Exploration", entreprise: null,
      documents: [{ id: genId(), type: "note", text: importJsxRaw.slice(0, 40000), label: "Code .jsx importé (source, tronqué à l'aperçu)", date: new Date().toISOString() }],
      conversation: [], date: new Date().toISOString(), discovery: { answers, synthesis, error: synthesisError }, conception, conceptionError,
      codeExistant: importJsxRaw,
    };
    await persistFullProject(full);
    const secteurLabel = { sante: "Santé", juridique: "Juridique", enfance: "Enfance", finance: "Finance", public: "Service public" }[detectedSectors[0]] || "Général";
    await persistIndex([{ id, nom: full.nom, categorie: full.categorie, statut: full.statut, date: full.date, hasDiscovery: Object.keys(answers).length > 0, hasConception: !!conception, secteurTag: secteurLabel }, ...index]);
    setImportingJsx(false);
    setImportJsxName(""); setImportJsxRaw(""); setImportJsxFileName(""); setImportJsxOpen(false);
    setSelectedId(id);
  }
  // Import en LOT, additif — contrairement à Réglages → Restaurer (qui
  // remplace tout), ceci ajoute des projets à la suite de l'index existant,
  // sans jamais toucher aux projets déjà là. Fait pour injecter des fiches
  // fictives (test de patterns) sans risquer les vraies données.
  async function importProjectsBatch(jsonText) {
    const data = JSON.parse(jsonText);
    const list = Array.isArray(data) ? data : data.projects;
    if (!Array.isArray(list) || !list.length) throw new Error("Format inattendu — un tableau de projets est attendu");
    const newEntries = [];
    for (const proj of list) {
      const id = genId();
      const answers = proj.discovery?.answers || {};
      const full = {
        id, nom: proj.nom || "Projet importé", categorie: proj.categorie || "Entreprise", statut: "Exploration",
        entreprise: proj.entreprise || null, documents: [], conversation: [], date: new Date().toISOString(),
        discovery: { answers, synthesis: proj.discovery?.synthesis || null, error: null },
        conception: null, pipeline: "Prospect",
      };
      await window.storage.set(`nandem-project:${id}`, JSON.stringify(full));
      const detected = detectSectors(answers.secteur?.text || "");
      const secteurLabel = { sante: "Santé", juridique: "Juridique", enfance: "Enfance", finance: "Finance", public: "Service public" }[detected[0]] || "Général";
      newEntries.push({ id, nom: full.nom, categorie: full.categorie, statut: full.statut, date: full.date, hasDiscovery: Object.keys(answers).length > 0, hasConception: false, secteurTag: secteurLabel, pipeline: "Prospect" });
    }
    await persistIndex([...newEntries, ...index]);
    return newEntries.length;
  }
  async function createProject() {
    if (!newName.trim() || creatingProject) return;
    setCreatingProject(true);
    const id = genId();
    const full = { id, nom: newName.trim(), categorie: newCategory, statut: "Exploration", entreprise: null, documents: [], conversation: [], date: new Date().toISOString(), discovery: null, conception: null };
    // On attend que l'écriture soit vraiment terminée avant de naviguer vers ce
    // projet — sinon la lecture immédiate qui suit peut arriver avant l'écriture
    // (course écriture/lecture, plus fréquente sur mobile), et l'écran reste vide.
    await persistFullProject(full);
    await persistIndex([{ id, nom: full.nom, categorie: full.categorie, statut: full.statut, date: full.date, hasDiscovery: false, hasConception: false }, ...index]);
    setCreatingProject(false);
    setNewName(""); setNewProjectOpen(false);
    setSelectedProject(full); // évite même d'avoir à relire — on a déjà l'objet
    setSelectedId(id);
  }
  async function createProjectFromSubmission(submission) {
    if (!submission || submission.status === "Importé" || creatingProject) return;
    setCreatingProject(true);
    const id = genId();
    const activity = submission.answers?.activite?.text?.trim();
    const nom = activity ? activity.slice(0, 70) : `Questionnaire client — ${new Date(submission.savedAt).toLocaleDateString("fr-FR")}`;
    const full = {
      id, nom, categorie: submission.categorie || "Entreprise", statut: "Exploration",
      entreprise: null, documents: [], conversation: [], date: submission.savedAt || new Date().toISOString(),
      discovery: { answers: submission.answers || {}, synthesis: submission.synthesis || null, error: submission.error || null },
      conception: null, pipeline: "Prospect", clientSubmissionSnapshot: submission,
    };
    try {
      await window.storage.set(`nandem-project:${id}`, JSON.stringify(full));
      const detected = detectSectors(submission.answers?.secteur?.text || "");
      const secteurLabel = { sante: "Santé", juridique: "Juridique", enfance: "Enfance", finance: "Finance", public: "Service public" }[detected[0]] || "Général";
      await persistIndex([{ id, nom, categorie: full.categorie, statut: full.statut, date: full.date, hasDiscovery: true, hasConception: false, secteurTag: secteurLabel, pipeline: "Prospect" }, ...index]);
      await persistClientSubmissions(clientSubmissions.map((item) => item.id === submission.id ? { ...item, status: "Importé", projectId: id, importedAt: new Date().toISOString() } : item));
      setSelectedProject(full);
      setSelectedId(id);
    } finally {
      setCreatingProject(false);
    }
  }
  function onDiscoveryComplete(answers, synthesis, error, conversation) {
    const updated = { ...selectedProject, discovery: { answers, synthesis, error }, conversation: conversation || [] };
    persistFullProject(updated);
    const detected = detectSectors(answers.secteur?.text || "");
    const secteurLabel = { sante: "Santé", juridique: "Juridique", enfance: "Enfance", finance: "Finance", public: "Service public" }[detected[0]] || "Général";
    persistIndex(index.map((p) => (p.id === selectedProject.id ? { ...p, hasDiscovery: true, secteurTag: secteurLabel } : p)));
  }
  async function retrySynthesis() {
    const answers = selectedProject.discovery?.answers || {};
    try {
      const synthesis = await buildSynthesis(answers, selectedProject.conversation);
      const updated = { ...selectedProject, discovery: { answers, synthesis, error: null } };
      await persistFullProject(updated);
      persistIndex(index.map((p) => (p.id === selectedProject.id ? { ...p, hasDiscovery: true } : p)));
    } catch (e) {
      const updated = { ...selectedProject, discovery: { answers, synthesis: null, error: `La synthèse a encore échoué (${e.message}). Réponses conservées.` } };
      await persistFullProject(updated);
    }
  }
  function onSetConception(text, error) {
    const updated = { ...selectedProject, conception: text, conceptionError: error || null };
    persistFullProject(updated);
    if (text) persistIndex(index.map((p) => (p.id === selectedProject.id ? { ...p, hasConception: true } : p)));
  }
  async function onCodeExistant(text) {
    try {
      const r = await window.storage.get(`nandem-project:${selectedId}`);
      const current = r ? JSON.parse(r.value) : selectedProject;
      persistFullProject({ ...current, codeExistant: text });
    } catch {
      persistFullProject({ ...selectedProject, codeExistant: text });
    }
  }
  function onUpdateProject(patch) {
    const updated = { ...selectedProject, ...patch };
    persistFullProject(updated);
    if (patch.statut) persistIndex(index.map((p) => (p.id === selectedProject.id ? { ...p, statut: patch.statut } : p)));
    if (patch.pipeline) persistIndex(index.map((p) => (p.id === selectedProject.id ? { ...p, pipeline: patch.pipeline } : p)));
  }
  // Mise à jour d'un projet par id, sans passer par la sélection courante —
  // utilisé par les onglets globaux Suivi/Facturation qui listent tous les
  // projets à plat plutôt que d'ouvrir une fiche.
  async function updateProjectFieldById(id, patch) {
    try {
      const r = await window.storage.get(`nandem-project:${id}`);
      const current = r ? JSON.parse(r.value) : { id };
      const updated = { ...current, ...patch };
      await window.storage.set(`nandem-project:${id}`, JSON.stringify(updated));
      if (selectedProject?.id === id) setSelectedProject(updated);
    } catch {}
    if (patch.pipeline) await persistIndex(index.map((p) => (p.id === id ? { ...p, pipeline: patch.pipeline } : p)));
  }
  // Suppression non destructive : le projet sort de la liste active et
  // apparaît dans Historique, mais ses données restent en storage — cohérent
  // avec le principe Method de non-effacement (une connaissance/un projet
  // devient ARCHIVÉ, jamais silencieusement perdu). "Restaurer" annule.
  async function archiveProject(id) {
    const now = new Date().toISOString();
    await persistIndex(index.map((p) => (p.id === id ? { ...p, archived: true, archivedDate: now } : p)));
    setSelectedId(null);
  }
  async function restoreProject(id) {
    await persistIndex(index.map((p) => (p.id === id ? { ...p, archived: false, archivedDate: undefined } : p)));
  }
  function addToLibrary(project, fieldKey, fieldLabel, text, onDone) { setPickerFor({ project, fieldKey, fieldLabel, text, onDone }); }
  function confirmAddToLibrary({ type, category, justification, source, niveauPreuve }) {
    const { project, fieldKey, fieldLabel, text, onDone } = pickerFor;
    persistLibrary([{ id: `${project.id}:${fieldKey}`, projectId: project.id, projectNom: project.nom, fieldLabel, text, category, type, justification: type === "decision" ? justification : undefined, source: type === "preuve" ? source : undefined, niveauPreuve: type === "preuve" ? niveauPreuve : undefined, statut: "À valider", date: new Date().toISOString() }, ...library]);
    setPickerFor(null);
    onDone?.(); // seulement maintenant que l'ajout a vraiment eu lieu — jamais avant
  }
  // Un seul clic ("Valider") applique le jugement déjà fait par l'IA au
  // moment de la détection — plus d'étape manuelle intermédiaire. "Établi"
  // n'est possible que si l'IA l'a explicitement jugé ainsi (voir les
  // prompts de détection : seuil à 3 projets indépendants, jamais par défaut).
  function statutFromConfiance(niveauConfiance) {
    if (niveauConfiance === "Établi") return "Établi";
    if (niveauConfiance === "Prometteur") return "Preuve à avoir";
    return "À faire";
  }
  function acceptProposal(p) { persistLibrary([{ id: `pattern:${genId()}`, projectId: "detecte", projectNom: (p.projetsConcernes || []).join(" + "), fieldLabel: `Pattern (${p.niveauConfiance})`, text: `${p.label} — ${p.description}`, category: "generique", type: "connaissance", statut: statutFromConfiance(p.niveauConfiance), date: new Date().toISOString() }, ...library]); }
  function addManualObservation(label, text) {
    if (!label.trim() || !text.trim()) return;
    const entry = { id: `observation:${genId()}`, projectId: "observation-importee", projectNom: "Apport manuel", fieldLabel: label.trim(), text: text.trim(), category: "generique", type: "connaissance", statut: "À valider", niveauPreuve: "Hypothèse", date: new Date().toISOString() };
    persistLibrary([entry, ...library]);
  }
  function importManualObservations(jsonText) {
    const parsed = JSON.parse(jsonText);
    const incoming = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.observations) ? parsed.observations : parsed.patterns);
    if (!Array.isArray(incoming)) throw new Error('Le JSON doit contenir un tableau "observations" ou "patterns".');
    const entries = []; let rejected = 0;
    incoming.forEach((raw) => {
      const label = raw?.label || raw?.nom || raw?.titre;
      const text = raw?.description || raw?.text || raw?.instruction;
      if (typeof label !== "string" || !label.trim() || typeof text !== "string" || !text.trim()) { rejected += 1; return; }
      entries.push({ id: `observation:${genId()}`, projectId: "observation-importee", projectNom: raw.source || "Import JSON", fieldLabel: label.trim(), text: text.trim(), category: "generique", type: "connaissance", statut: "À valider", niveauPreuve: raw.statut || "Hypothèse", source: raw.source || "Fichier JSON importé", date: new Date().toISOString() });
    });
    if (!entries.length && incoming.length) throw new Error("Aucune observation valide : chaque élément doit avoir label et description (ou text/instruction).");
    persistLibrary([...entries, ...library]);
    return { added: entries.length, rejected };
  }
  function updatePatternStatut(id, statut) { persistLibrary(library.map((l) => (l.id === id ? { ...l, statut } : l))); }
  async function scanAllProjectsForPatterns() {
    const withDiscovery = index.filter((p) => p.hasDiscovery).slice(0, MAX_PATTERN_PROJECTS);
    const fetched = [];
    let skippedNoSynthesis = 0;
    for (const p of withDiscovery) {
      try {
        const r = await window.storage.get(`nandem-project:${p.id}`);
        if (r) {
          const full = JSON.parse(r.value);
          if (full.discovery?.synthesis) fetched.push({ nom: full.nom, synthesis: full.discovery.synthesis });
          else skippedNoSynthesis++;
        }
      } catch {}
    }
    const result = await detectPatternsFromProjects(fetched);
    return { ...result, totalEligible: index.filter((p) => p.hasDiscovery).length, skippedNoSynthesis };
  }
  // Rassemble un résumé chiffré (jamais les détails bruts d'un projet) pour
  // les suggestions d'optimisation business — la vie privée de chaque client
  // reste dans sa fiche, seuls des agrégats en sortent.
  async function suggestBusinessOptimizationsForApp() {
    const active = index.filter((p) => !p.archived);
    const stageCounts = {};
    PIPELINE_STAGES.forEach((s) => { stageCounts[s] = 0; });
    active.forEach((p) => { const st = p.pipeline || "Prospect"; stageCounts[st] = (stageCounts[st] || 0) + 1; });
    const categoryCounts = {};
    let devis = 0, paye = 0, withFinance = 0;
    for (const p of active) {
      categoryCounts[p.categorie] = (categoryCounts[p.categorie] || 0) + 1;
      try {
        const r = await window.storage.get(`nandem-project:${p.id}`);
        if (r) { const full = JSON.parse(r.value); if (full.finance?.devis != null || full.finance?.paye != null) { devis += full.finance.devis || 0; paye += full.finance.paye || 0; withFinance++; } }
      } catch {}
    }
    const genericPatterns = library.filter((l) => l.category === "generique").length;
    const summary = `Nombre total de projets actifs : ${active.length}
Répartition par étape commerciale : ${PIPELINE_STAGES.map((s) => `${s} : ${stageCounts[s]}`).join(", ")}
Répartition par catégorie : ${Object.entries(categoryCounts).map(([c, n]) => `${c} : ${n}`).join(", ") || "aucune"}
Projets avec un devis ou un montant encaissé : ${withFinance}
Devis cumulés : ${devis} € — Encaissé : ${paye} € — Reste dû : ${devis - paye} €
Patterns génériques déjà validés dans la bibliothèque : ${genericPatterns}
Leçons intégrées au dossier universel : ${promptAddendum ? promptAddendum.split("\n").filter(Boolean).length : 0}`;
    return await suggestBusinessOptimizations(summary);
  }
  async function promoteToQuestion(entry, questionText, importance) {
    // fieldLabel d'un pattern est juste son niveau de confiance ("Pattern
    // (Hypothèse)") — jamais un nom utilisable. Le vrai nom du mécanisme est
    // la première partie du texte, avant le " — ". Sans ça, tout retombait
    // sur "Question personnalisée" pour les patterns promus.
    const derivedLabel = entry.text?.split(" — ")[0]?.trim();
    const newGoal = { id: `custom_${genId()}`, label: derivedLabel || entry.fieldLabel || "Question personnalisée", importance, cost: 2, dependsOn: ["activite"], question: questionText, date: new Date().toISOString() };
    const next = [...customGoals, newGoal];
    setCustomGoals(next);
    try { await window.storage.set("nandem-custom-goals", JSON.stringify(next)); } catch {}
    persistLibrary(library.map((l) => (l.id === entry.id ? { ...l, promoted: true } : l)));
  }
  async function copyClientLink() {
    const base = window.location.href.split("?")[0];
    const token = genId();
    const link = `${base}?client=1&token=${token}`;
    try {
      if (!navigator.clipboard) throw new Error("indisponible");
      await navigator.clipboard.writeText(link);
      setCopiedLink(true);
      setClientLinkFallback(null);
      setTimeout(() => setCopiedLink(false), 1800);
    } catch {
      // Ne jamais afficher "Copié" sans confirmation réelle — on montre le
      // lien en clair, à copier manuellement.
      setClientLinkFallback(link);
    }
  }

  const libraryIds = new Set(library.map((l) => l.id));
  if (!loaded) return <div className={`min-h-screen bg-app flex items-center justify-center ${themeClass}`}><GlobalStyle /><Loader2 className="animate-spin text-amber-400" /></div>;
  if (showOnboarding) return <Onboarding onFinish={finishOnboarding} theme={theme} />;

  return (
    <div className={`min-h-screen w-full max-w-full overflow-x-hidden bg-app text-cream font-sans ${themeClass}`}>
      <GlobalStyle />
      <header className="border-b border-app px-4 py-3 flex items-center justify-between gap-2 flex-wrap sticky top-0 bg-app/95 backdrop-blur z-10">
        <div className="flex items-center gap-2 min-w-0">
          {selectedId ? (<button onClick={() => setSelectedId(null)} className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 transition-colors min-w-0"><ChevronLeft size={16} className="shrink-0" /><span className="text-sm truncate">{selectedProject?.nom || "…"}</span></button>) : (<><Sparkles size={18} className="text-amber-400 shrink-0" strokeWidth={1.75} /><h1 className="font-display text-lg tracking-tight">NANDĒM Core</h1></>)}
        </div>
        {!selectedId && (
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            <button onClick={copyClientLink} title="Génère un nouveau lien à usage unique à chaque clic" className="flex items-center gap-1.5 text-11 px-2.5 py-1.5 rounded-full border border-app text-slate-400 hover:border-amber-400/30 hover:text-amber-300 transition-colors shrink-0">{copiedLink ? <Check size={12} /> : <Link2 size={12} />}<span className="hidden sm:inline">{copiedLink ? "Copié (usage unique)" : "Lien client"}</span></button>
            <nav className="flex gap-1 bg-surface rounded-full p-1 shrink-0">
              <button onClick={() => setTab("projets")} title="Projets" className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-12 transition-colors ${tab === "projets" ? "bg-amber-400 text-app" : "text-slate-400"}`}><FolderOpen size={13} /><span className="hidden sm:inline">Projets</span></button>
              <button onClick={() => setTab("suivi")} title="Suivi" className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-12 transition-colors ${tab === "suivi" ? "bg-amber-400 text-app" : "text-slate-400"}`}><Users size={13} /><span className="hidden sm:inline">Suivi</span></button>
              <button onClick={() => setTab("facturation")} title="Facturation" className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-12 transition-colors ${tab === "facturation" ? "bg-amber-400 text-app" : "text-slate-400"}`}><Receipt size={13} /><span className="hidden sm:inline">Facturation</span></button>
              <button onClick={() => setTab("bilan")} title="Bilan" className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-12 transition-colors ${tab === "bilan" ? "bg-amber-400 text-app" : "text-slate-400"}`}><TrendingUp size={13} /><span className="hidden sm:inline">Bilan</span></button>
              <button onClick={() => setTab("bibliotheque")} title="Optimisation" className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-12 transition-colors ${tab === "bibliotheque" ? "bg-amber-400 text-app" : "text-slate-400"}`}><Library size={13} /><span className="hidden sm:inline">Optimisation</span></button>
              <button onClick={() => setTab("historique")} title="Historique" aria-label="Historique" className={`flex items-center px-2.5 py-1.5 rounded-full text-12 transition-colors ${tab === "historique" ? "bg-amber-400 text-app" : "text-slate-400"}`}><History size={13} /></button>
              <button onClick={() => setTab("corbeille")} title="Corbeille" aria-label="Corbeille" className={`flex items-center px-2.5 py-1.5 rounded-full text-12 transition-colors ${tab === "corbeille" ? "bg-amber-400 text-app" : "text-slate-400"}`}><Trash2 size={13} /></button>
              <button onClick={() => setTab("reglages")} title="Réglages" aria-label="Réglages" className={`flex items-center px-2.5 py-1.5 rounded-full text-12 transition-colors ${tab === "reglages" ? "bg-amber-400 text-app" : "text-slate-400"}`}><SettingsIcon size={13} /></button>
            </nav>
          </div>
        )}
      </header>

      {clientLinkFallback && (
        <div className="max-w-2xl mx-auto px-5 pt-4 w-full">
          <div className="p-3 rounded-xl bg-surface border border-app">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-11 text-red-300">Copie automatique indisponible — sélectionne le lien manuellement</p>
              <button onClick={() => setClientLinkFallback(null)} className="text-slate-500 text-11">Fermer</button>
            </div>
            <textarea readOnly value={clientLinkFallback} onFocus={(e) => e.target.select()} rows={2} className="w-full bg-surface-2 border border-app rounded-lg p-2.5 text-11 text-slate-300 font-mono-data" />
          </div>
        </div>
      )}

      {!selectedId && tab === "projets" && (
        <div className="max-w-2xl mx-auto px-5 py-6">
          <div className="mb-5 p-4 rounded-xl bg-surface border border-app">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <h2 className="text-sm text-cream">Questionnaires clients reçus</h2>
                <p className="text-11 text-slate-500 mt-0.5">{clientSubmissions.filter((item) => item.status !== "Importé").length} à transformer en projet</p>
              </div>
              <button onClick={refreshClientSubmissions} className="text-11 px-3 py-1.5 rounded-lg border border-app text-slate-400 hover:text-amber-300">Actualiser</button>
            </div>
            {clientSubmissions.filter((item) => item.status !== "Importé").length === 0 ? (
              <p className="text-12 text-slate-600">Aucun nouveau questionnaire. Les réponses enregistrées depuis un lien client apparaîtront ici.</p>
            ) : (
              <div className="space-y-2">
                {clientSubmissions.filter((item) => item.status !== "Importé").map((submission) => (
                  <div key={submission.id} className="p-3 rounded-lg bg-surface-2 border border-app flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-13 text-slate-200 truncate">{submission.answers?.activite?.text || "Projet client sans titre"}</p>
                      <p className="text-10 text-slate-500 mt-1">{submission.categorie || "Entreprise"} · {new Date(submission.savedAt).toLocaleString("fr-FR")}</p>
                    </div>
                    <button onClick={() => createProjectFromSubmission(submission)} disabled={creatingProject} className="shrink-0 text-11 bg-amber-400 text-app px-3 py-1.5 rounded-lg disabled:opacity-50">Créer le projet</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-2 mb-5 flex-wrap">
            <button onClick={() => openProjectEntry("new")} className="flex-1 py-3 rounded-xl border border-dashed border-app-strong text-slate-400 hover:border-amber-400/40 hover:text-amber-300 transition-colors flex items-center justify-center gap-2 text-sm min-w-[140px]"><Plus size={15} /> Nouveau projet</button>
            <button onClick={() => openProjectEntry("email")} className="flex-1 py-3 rounded-xl border border-dashed border-app-strong text-slate-400 hover:border-amber-400/40 hover:text-amber-300 transition-colors flex items-center justify-center gap-2 text-sm min-w-[140px]"><Mail size={15} /> Importer un email</button>
            <button onClick={() => openProjectEntry("markdown")} className="flex-1 py-3 rounded-xl border border-dashed border-app-strong text-slate-400 hover:border-amber-400/40 hover:text-amber-300 transition-colors flex items-center justify-center gap-2 text-sm min-w-[140px]"><FileText size={15} /> Importer une idée (Markdown)</button>
            <button onClick={() => openProjectEntry("batch")} className="flex-1 py-3 rounded-xl border border-dashed border-app-strong text-slate-400 hover:border-amber-400/40 hover:text-amber-300 transition-colors flex items-center justify-center gap-2 text-sm min-w-[140px]"><Users size={15} /> Importer des projets (JSON, lot)</button>
            <button onClick={() => openProjectEntry("jsx")} className="flex-1 py-3 rounded-xl border border-dashed border-app-strong text-slate-400 hover:border-amber-400/40 hover:text-amber-300 transition-colors flex items-center justify-center gap-2 text-sm min-w-[140px]"><FileCode size={15} /> Importer un .jsx (appli déjà construite)</button>
          </div>
          {importBatchOpen && (
            <div className="mb-5 p-4 rounded-xl bg-surface border border-app space-y-3">
              <p className="text-11 text-slate-500">Colle un tableau JSON de projets (fiches fictives ou réelles déjà structurées). Additif — n'écrase jamais les projets existants, contrairement à Réglages → Restaurer.</p>
              <textarea value={importBatchRaw} onChange={(e) => setImportBatchRaw(e.target.value)} rows={10} placeholder="Colle ici le tableau JSON de projets…" className="w-full bg-surface-2 border border-app rounded-xl px-3.5 py-2.5 text-11 placeholder:text-slate-600 font-mono-data" />
              {importBatchResult && (importBatchResult.ok ? <p className="text-12 text-amber-300">{importBatchResult.count} projet{importBatchResult.count > 1 ? "s" : ""} ajouté{importBatchResult.count > 1 ? "s" : ""}.</p> : <p className="text-12 text-red-300">Échec ({importBatchResult.error}).</p>)}
              <div className="flex gap-2 justify-end">
                <button onClick={() => { setImportBatchOpen(false); setImportBatchResult(null); }} className="text-13 text-slate-500 px-3 py-1.5">Fermer</button>
                <button onClick={async () => { if (!importBatchRaw.trim() || importingBatch) return; setImportingBatch(true); try { const count = await importProjectsBatch(importBatchRaw); setImportBatchResult({ ok: true, count }); setImportBatchRaw(""); } catch (e) { setImportBatchResult({ ok: false, error: e.message }); } setImportingBatch(false); }} disabled={!importBatchRaw.trim() || importingBatch} className="text-13 bg-amber-400 text-app px-3 py-1.5 rounded-lg disabled:opacity-40 flex items-center gap-2">{importingBatch && <Loader2 size={14} className="animate-spin" />}{importingBatch ? "Import…" : "Importer le lot"}</button>
              </div>
            </div>
          )}
          {importMdOpen && (
            <div className="mb-5 p-4 rounded-xl bg-surface border border-app space-y-3">
              <p className="text-11 text-slate-500">Colle un texte libre (idée brainstormée avec une autre IA, notes en Markdown...). L'IA de tri essaie de remplir les questions du diagnostic à partir de ce texte — vérifie et complète ensuite dans la fiche projet.</p>
              <input value={importMdName} onChange={(e) => setImportMdName(e.target.value)} placeholder="Nom du projet" className="w-full bg-surface-2 border border-app rounded-lg px-3 py-2 text-14 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-400/40" />
              <div className="flex gap-2">{CATEGORIES.map((c) => (<button key={c} onClick={() => setImportMdCategory(c)} className={`px-3 py-1.5 rounded-full text-12 border transition-colors ${importMdCategory === c ? "bg-amber-400 text-app border-amber-400" : "border-app text-slate-400"}`}>{c}</button>))}</div>
              <textarea value={importMdRaw} onChange={(e) => setImportMdRaw(e.target.value)} rows={10} placeholder="Colle ici le Markdown ou le texte de l'idée…" className="w-full bg-surface-2 border border-app rounded-xl px-3.5 py-2.5 text-13 placeholder:text-slate-600 font-mono-data" />
              <div className="flex gap-2 justify-end"><button onClick={() => setImportMdOpen(false)} className="text-13 text-slate-500 px-3 py-1.5">Annuler</button><button onClick={importMarkdownIdea} disabled={!importMdName.trim() || !importMdRaw.trim() || importingMd} className="text-13 bg-amber-400 text-app px-3 py-1.5 rounded-lg disabled:opacity-40 flex items-center gap-2">{importingMd && <Loader2 size={14} className="animate-spin" />}{importingMd ? "Tri en cours…" : "Importer et trier"}</button></div>
            </div>
          )}
          {importJsxOpen && (
            <div className="mb-5 p-4 rounded-xl bg-surface border border-app space-y-3">
              <p className="text-11 text-slate-500">Choisis directement le fichier .jsx d'une appli que tu as déjà construite (ou colle son contenu ci-dessous). Trois appels IA s'enchaînent automatiquement : lecture du code, synthèse du diagnostic, puis conception — à la fin, les patterns détectés ("Socle appliqué") sont visibles directement dans l'onglet Conception de la fiche. Le code est aussi conservé dans "Code existant" (mode reprise). Sur un fichier volumineux, seuls les 40 000 premiers caractères sont lus — les réponses générées restent à relire, pas à prendre pour acquises. Si une des trois étapes échoue (ex. crédit API), le projet est quand même créé avec ce qui a réussi, à réessayer depuis sa fiche.</p>
              <input ref={jsxFileInputRef} type="file" accept=".jsx,.js,.tsx,.ts,text/plain" onChange={handleJsxFileChange} className="hidden" />
              <div className="flex items-center gap-2">
                <button onClick={() => jsxFileInputRef.current?.click()} className="text-13 bg-surface-2 border border-app rounded-lg px-3 py-2 flex items-center gap-2 hover:border-amber-400/40"><FileCode size={14} /> Choisir un fichier .jsx</button>
                {importJsxFileName && <span className="text-11 text-slate-500 truncate">{importJsxFileName} ({(importJsxRaw.length / 1024).toFixed(0)} Ko)</span>}
              </div>
              <input value={importJsxName} onChange={(e) => setImportJsxName(e.target.value)} placeholder="Nom du projet (ex. L'Œil)" className="w-full bg-surface-2 border border-app rounded-lg px-3 py-2 text-14 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-400/40" />
              <div className="flex gap-2">{CATEGORIES.map((c) => (<button key={c} onClick={() => setImportJsxCategory(c)} className={`px-3 py-1.5 rounded-full text-12 border transition-colors ${importJsxCategory === c ? "bg-amber-400 text-app border-amber-400" : "border-app text-slate-400"}`}>{c}</button>))}</div>
              <textarea value={importJsxRaw} onChange={(e) => { setImportJsxRaw(e.target.value); setImportJsxFileName(""); }} rows={10} placeholder="…ou colle ici le contenu du fichier .jsx" className="w-full bg-surface-2 border border-app rounded-xl px-3.5 py-2.5 text-11 placeholder:text-slate-600 font-mono-data" />
              <div className="flex gap-2 justify-end"><button onClick={() => setImportJsxOpen(false)} className="text-13 text-slate-500 px-3 py-1.5">Annuler</button><button onClick={importJsxApp} disabled={!importJsxName.trim() || !importJsxRaw.trim() || importingJsx} className="text-13 bg-amber-400 text-app px-3 py-1.5 rounded-lg disabled:opacity-40 flex items-center gap-2">{importingJsx && <Loader2 size={14} className="animate-spin" />}{importingJsx ? "Analyse, synthèse et conception…" : "Importer et détecter les patterns"}</button></div>
            </div>
          )}
          {importOpen && (
            <div className="mb-5 p-4 rounded-xl bg-surface border border-app space-y-3">
              <p className="text-11 text-slate-500">Colle le corps de l'email reçu du questionnaire client. Aucun appel IA ici — juste les réponses brutes, à toi de décider ensuite si tu génères la synthèse.</p>
              <input value={importName} onChange={(e) => setImportName(e.target.value)} placeholder="Nom du projet" className="w-full bg-surface-2 border border-app rounded-lg px-3 py-2 text-14 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-400/40" />
              <div className="flex gap-2">{CATEGORIES.map((c) => (<button key={c} onClick={() => setImportCategory(c)} className={`px-3 py-1.5 rounded-full text-12 border transition-colors ${importCategory === c ? "bg-amber-400 text-app border-amber-400" : "border-app text-slate-400"}`}>{c}</button>))}</div>
              <textarea value={importRaw} onChange={(e) => setImportRaw(e.target.value)} rows={8} placeholder="Colle ici tout le corps de l'email…" className="w-full bg-surface-2 border border-app rounded-xl px-3.5 py-2.5 text-13 placeholder:text-slate-600 font-mono-data" />
              <div className="flex gap-2 justify-end"><button onClick={() => setImportOpen(false)} className="text-13 text-slate-500 px-3 py-1.5">Annuler</button><button onClick={importClientEmail} disabled={!importName.trim() || !importRaw.trim() || creatingProject} className="text-13 bg-amber-400 text-app px-3 py-1.5 rounded-lg disabled:opacity-40">Importer</button></div>
            </div>
          )}
          {newProjectOpen && (<div className="mb-5 p-4 rounded-xl bg-surface border border-app space-y-3"><input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && createProject()} placeholder="Nom du projet" className="w-full bg-surface-2 border border-app rounded-lg px-3 py-2 text-14 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-400/40" /><div className="flex gap-2">{CATEGORIES.map((c) => (<button key={c} onClick={() => setNewCategory(c)} className={`px-3 py-1.5 rounded-full text-12 border transition-colors ${newCategory === c ? "bg-amber-400 text-app border-amber-400" : "border-app text-slate-400"}`}>{c}</button>))}</div><div className="flex gap-2 justify-end"><button onClick={() => setNewProjectOpen(false)} className="text-13 text-slate-500 px-3 py-1.5">Annuler</button><button onClick={createProject} className="text-13 bg-amber-400 text-app px-3 py-1.5 rounded-lg">Créer</button></div></div>)}
          {index.length === 0 && !newProjectOpen && <p className="text-slate-500 text-sm text-center py-8">Aucun projet — commence par en créer un, ou attends qu'un client envoie son diagnostic par email.</p>}
          {(() => {
            function ProjectRow(p) {
              return (
                <button key={p.id} onClick={() => setSelectedId(p.id)} className="w-full text-left p-4 rounded-xl bg-surface border border-app hover:border-amber-400/30 transition-colors flex items-center justify-between group">
                  <div><p className="text-sm text-cream">{p.nom}</p><div className="flex items-center gap-2 mt-1 flex-wrap"><span className="text-10 px-2 py-0.5 rounded-full border border-app text-slate-500">{p.categorie}</span><span className="text-10 px-2 py-0.5 rounded-full border border-amber-400/20 text-amber-400/70">{p.pipeline || "Prospect"}</span><span className="text-10 text-slate-600 font-mono-data">{p.hasConception ? "Conception prête" : p.hasDiscovery ? "Diagnostic terminé" : "Diagnostic non fait"}</span></div></div>
                  <ChevronRight size={16} className="text-slate-600 group-hover:text-amber-400 transition-colors" />
                </button>
              );
            }
            const recents = index.filter((p) => !p.archived).slice(0, 5);
            const isEntreprise = (cat) => cat === "Entreprise" || cat === "Client";
            const isAppCat = (cat) => cat === "App" || cat === "Laboratoire" || cat === "Interne";
            const entrepriseProjects = index.filter((p) => isEntreprise(p.categorie) && !p.archived);
            const appProjects = index.filter((p) => isAppCat(p.categorie) && !p.archived);
            const autresProjects = index.filter((p) => !isEntreprise(p.categorie) && !isAppCat(p.categorie) && !p.archived);
            const bySecteur = {};
            entrepriseProjects.forEach((p) => { const s = p.secteurTag || "Général"; if (!bySecteur[s]) bySecteur[s] = []; bySecteur[s].push(p); });
            const flattened = [...entrepriseProjects, ...appProjects, ...autresProjects];
            const visible = new Set(flattened.slice(0, visibleCount).map((p) => p.id));
            return (
              <>
                {recents.length > 0 && (
                  <div className="mb-6">
                    <p className="text-11 uppercase tracking-wider text-slate-500 mb-2">Récents</p>
                    <div className="space-y-2">{recents.map(ProjectRow)}</div>
                  </div>
                )}
                {entrepriseProjects.length > 0 && (
                  <div className="mb-6">
                    <p className="text-11 uppercase tracking-wider text-amber-400/70 mb-2">Entreprise</p>
                    {Object.entries(bySecteur).map(([secteur, items]) => {
                      const shown = items.filter((p) => visible.has(p.id));
                      if (!shown.length) return null;
                      return (
                        <div key={secteur} className="mb-4">
                          <p className="text-10 text-slate-600 mb-1.5 pl-1">{secteur}</p>
                          <div className="space-y-2">{shown.map(ProjectRow)}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {appProjects.filter((p) => visible.has(p.id)).length > 0 && (
                  <div className="mb-6">
                    <p className="text-11 uppercase tracking-wider text-amber-400/70 mb-2">App</p>
                    <div className="space-y-2">{appProjects.filter((p) => visible.has(p.id)).map(ProjectRow)}</div>
                  </div>
                )}
                {autresProjects.filter((p) => visible.has(p.id)).length > 0 && (
                  <div className="mb-6">
                    <p className="text-11 uppercase tracking-wider text-slate-500 mb-2">Autres</p>
                    <div className="space-y-2">{autresProjects.filter((p) => visible.has(p.id)).map(ProjectRow)}</div>
                  </div>
                )}
                {flattened.length > visibleCount && (<button onClick={() => setVisibleCount((v) => v + PROJECTS_PAGE_SIZE)} className="w-full mt-1 py-2 text-12 text-slate-500 hover:text-amber-400 transition-colors">Charger plus ({flattened.length - visibleCount} restants)</button>)}
              </>
            );
          })()}
        </div>
      )}
      {!selectedId && tab === "suivi" && <SuiviView index={index} onFieldUpdate={updateProjectFieldById} onOpenProject={setSelectedId} studioName={settings.studioName} feedbackEmail={settings.feedbackEmail} tarifSettings={settings} initialStage={suiviInitialStage} />}
      {!selectedId && tab === "facturation" && <FacturationView index={index} onFieldUpdate={updateProjectFieldById} tarifSettings={settings} studioName={settings.studioName} feedbackEmail={settings.feedbackEmail} tarifHoraire={settings.tarifHoraire} />}
      {!selectedId && tab === "bilan" && <BilanView index={index} onOpenProject={setSelectedId} onOpenStage={(stage) => { setSuiviInitialStage(stage); setTab("suivi"); }} onSuggestBusiness={suggestBusinessOptimizationsForApp} onAcceptProposal={acceptProposal} />}
      {!selectedId && tab === "bibliotheque" && <LibraryView library={library} onRemove={(id) => persistLibrary(library.filter((l) => l.id !== id))} onAcceptProposal={acceptProposal} onPromote={promoteToQuestion} onScanProjects={scanAllProjectsForPatterns} promptFeedback={promptFeedback} promptAddendum={promptAddendum} onPromoteFeedback={promotePromptFeedback} onDismissFeedback={dismissPromptFeedback} onPromoteSynthesized={promoteSynthesizedLesson} index={index} customGoals={customGoals} questionOverrides={questionOverrides} onAnalyzeQuestionnaires={analyzeQuestionnairesForApp} onAcceptQuestionImprovement={acceptQuestionImprovement} onRevertQuestionImprovement={revertQuestionImprovement} onUpdateStatut={updatePatternStatut} engineRequirements={engineRequirements} onImportRequirements={importEngineRequirements} onRemoveRequirement={(id) => persistEngineRequirements(engineRequirements.filter((r) => r.id !== id))} onUpdateRequirement={updateEngineRequirement} onAnalyzeFormalization={analyzeObservationsForFormalization} onAcceptFormalization={acceptFormalizedRequirement} onAddManualObservation={addManualObservation} onImportManualObservations={importManualObservations} />}
      {!selectedId && tab === "historique" && <HistoriqueView index={index} onArchiveProject={archiveProject} onSelectProject={setSelectedId} library={library} onUpdateStatut={updatePatternStatut} onRemove={(id) => persistLibrary(library.filter((l) => l.id !== id))} />}
      {!selectedId && tab === "corbeille" && <CorbeilleView index={index} onRestoreProject={restoreProject} onSelectProject={setSelectedId} />}
      {!selectedId && tab === "reglages" && <ReglagesView settings={settings} onSave={saveSettings} onReplayOnboarding={() => setShowOnboarding(true)} theme={theme} setTheme={setTheme} apiKey={apiKey} onSaveApiKey={saveApiKey} customAiKey={customAiKey} onSaveCustomAiKey={saveCustomAiKey} onExportAll={exportEverything} onImportAll={importEverything} />}
      {selectedId && loadingSelected && <div className="flex items-center justify-center h-header-offset"><Loader2 className="animate-spin text-amber-400" /></div>}
      {selectedId && !loadingSelected && !selectedProject && (
        <div className="flex flex-col items-center justify-center h-header-offset px-6 text-center gap-3">
          <p className="text-sm text-slate-400">Impossible de charger ce projet. Ça arrive parfois sur mobile — le stockage est moins fiable que sur navigateur web.</p>
          <button onClick={() => { const id = selectedId; setSelectedId(null); setTimeout(() => setSelectedId(id), 50); }} className="text-13 bg-amber-400 text-app px-4 py-2 rounded-lg">Réessayer</button>
        </div>
      )}
      {selectedId && !loadingSelected && selectedProject && !selectedProject.discovery && <PreDiscoveryProject project={selectedProject} onUpdateProject={onUpdateProject} onComplete={onDiscoveryComplete} onCodeExistant={onCodeExistant} customGoals={customGoals} questionOverrides={questionOverrides} studioName={settings.studioName} feedbackEmail={settings.feedbackEmail} tarifHoraire={settings.tarifHoraire} />}
      {selectedId && !loadingSelected && selectedProject && selectedProject.discovery && (<ProjectDetail project={selectedProject} onAddToLibrary={addToLibrary} libraryIds={libraryIds} onSetConception={onSetConception} onUpdateProject={onUpdateProject} onRetrySynthesis={retrySynthesis} promptAddendum={promptAddendum} engineRequirements={engineRequirements} onSaveFeedback={savePromptFeedback} onArchiveProject={archiveProject} studioName={settings.studioName} feedbackEmail={settings.feedbackEmail} tarifHoraire={settings.tarifHoraire} />)}
      {pickerFor && <LibraryEntryPicker entryText={pickerFor.text} entryLabel={pickerFor.fieldLabel} onConfirm={confirmAddToLibrary} onCancel={() => setPickerFor(null)} />}
    </div>
  );
}

function useTheme() {
  const [theme, setThemeState] = useState("dark"); // sombre par défaut
  useEffect(() => { (async () => {
    try { const r = await window.storage.get("nandem-theme"); if (r && (r.value === "light" || r.value === "dark")) setThemeState(r.value); } catch {}
  })(); }, []);
  async function setTheme(t) { setThemeState(t); try { await window.storage.set("nandem-theme", t); } catch {} }
  return [theme, setTheme];
}

export default function NandemCoreRoot() {
  const [isClientMode] = useState(() => { try { return new URLSearchParams(window.location.search).get("client") === "1"; } catch { return false; } });
  const [theme, setTheme] = useTheme();
  return isClientMode ? <ClientDiscoveryShell theme={theme} /> : <AdminApp theme={theme} setTheme={setTheme} />;
}
