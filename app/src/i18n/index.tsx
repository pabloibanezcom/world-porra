import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as Localization from 'expo-localization';
import { getToken, setToken } from '../store/tokenStorage';
import { setApiLanguage } from '../api/client';

export type Language = 'en' | 'es';

type TranslationValue = string | ((params: Record<string, string | number>) => string);
type TranslationMap = Record<string, TranslationValue>;

const LANGUAGE_STORAGE_KEY = 'wc2026.language';

function getDeviceLanguage(): Language {
  const locale = Localization.getLocales()[0];
  const languageCode = locale?.languageCode?.toLowerCase();
  const languageTag = locale?.languageTag?.toLowerCase();

  return languageCode === 'es' || languageTag?.startsWith('es-') ? 'es' : 'en';
}

const translations: Record<Language, TranslationMap> = {
  en: {
    'common.admin': 'Admin',
    'common.cancel': 'Cancel',
    'common.done': 'done',
    'common.error': 'Error',
    'common.final': 'Final',
    'common.group': ({ group }) => `Group ${group}`,
    'common.inProgress': 'in progress',
    'common.language': 'Language',
    'common.live': 'LIVE',
    'common.member': 'Member',
    'common.missing': 'Missing',
    'common.notAvailable': 'Not available',
    'common.ok': 'OK',
    'common.points': 'points',
    'common.pointsShort': 'pts',
    'common.rank': 'rank',
    'common.share': 'Share',
    'common.you': 'You',
    'common.yourPick': 'your pick',
    'common.pick': 'pick',
    'common.vs': 'vs',
    'common.tbd': 'TBD',
    'language.en': 'English',
    'language.es': 'Spanish',

    'nav.home': 'Home',
    'nav.leagues': 'Leagues',
    'nav.predictions': 'Predictions',
    'nav.profile': 'Profile',
    'nav.createLeague': 'Create League',
    'nav.joinLeague': 'Join League',
    'nav.match': 'Match',

    'login.title': 'World Cup Pool',
    'login.subtitle': '2026 FIFA · USA · Canada · Mexico',
    'login.email': 'Email',
    'login.password': 'Password',
    'login.passwordPlaceholder': 'Your password',
    'login.continueEmail': 'Continue with Email',
    'login.or': 'or',
    'login.googleNotConfigured': 'Sign in with Google (not configured)',
    'login.signingIn': 'Signing in...',
    'login.continueGoogle': 'Continue with Google',
    'login.finePrint': 'By continuing you agree to the pool rules.\nYour picks are visible to other members.',
    'login.required': 'Email and password are required.',
    'login.passwordFailed': 'Email/password login failed. Please check your credentials.',
    'login.signInFailed': 'Sign in failed. Please try again.',
    'login.createAccount': "Don't have an account? Create one",

    'register.title': 'Create Account',
    'register.subtitle': '2026 FIFA · USA · Canada · Mexico',
    'register.name': 'Your Name',
    'register.namePlaceholder': 'Name shown in leagues',
    'register.email': 'Email',
    'register.password': 'Password',
    'register.passwordPlaceholder': 'Min. 8 characters',
    'register.submit': 'Create Account',
    'register.alreadyHaveAccount': 'Already have an account? Sign in',
    'register.finePrint': 'By creating an account you agree to the pool rules.\nYour picks are visible to other members.',
    'register.required': 'Name, email and password are required.',
    'register.passwordTooShort': 'Password must be at least 8 characters.',
    'register.emailTaken': 'An account with this email already exists.',
    'register.failed': 'Registration failed. Please try again.',

    'home.goodMorning': 'Good morning',
    'home.goodAfternoon': 'Good afternoon',
    'home.goodEvening': 'Good evening',
    'home.fan': 'Fan',
    'home.nextMatches': 'Next Matches',
    'home.leagues': 'Leagues',
    'home.recentResults': 'Recent Results',
    'home.noMatches': 'No matches yet.',
    'home.fixturesSynced': 'Fixtures will appear once synced.',

    'leagues.privatePools': ({ count }) => `${count} private pools`,
    'leagues.joinPrivatePool': 'Join a private pool',
    'leagues.joinLeague': 'Join League',
    'leagues.noLeagues': 'No leagues yet.',
    'leagues.emptyHint': 'Join a league to compete with friends.',
    'leagues.players': ({ count }) => `${count} players`,
    'leagues.playersWithPoints': ({ count, points }) => `${count} players · ${points} pts`,

    'picks.title': 'My Picks',
    'picks.subtitle': '2026 FIFA World Cup · Group Stage',
    'picks.upcoming': 'Upcoming',
    'picks.results': 'Results',
    'picks.groups': 'Groups',
    'picks.finals': 'Finals',
    'picks.noUpcoming': 'No upcoming matches.',
    'picks.noResults': 'No results yet.',
    'picks.groupsPending': 'Groups will appear once teams are confirmed.',
    'picks.groupStage': 'Group Stage',

    'profile.rankTag': ({ rank }) => `Rank #${rank}`,
    'profile.matches': ({ count }) => `${count} matches`,
    'profile.exactScores': 'Exact Scores',
    'profile.notifications': 'Notifications',
    'profile.pushNotifications': 'Push notifications',
    'profile.admin': 'Admin',
    'profile.notifyAll': 'Notify all members',
    'profile.account': 'Account',
    'profile.editProfile': 'Edit profile',
    'profile.displayName': 'Display name',
    'profile.displayNamePlaceholder': 'Name shown in leagues',
    'profile.saveName': 'Save name',
    'profile.nameRequired': 'Display name is required.',
    'profile.nameTooLong': 'Display name must be 40 characters or fewer.',
    'profile.nameUpdated': 'Display name updated.',
    'profile.nameUpdateFailed': 'Failed to update display name.',
    'profile.signOut': 'Sign out',

    'league.notFound': 'League not found',
    'league.playersGroupStage': ({ count }) => `${count} players · Group Stage`,
    'league.yourRank': 'Your rank',
    'league.yourPoints': 'Your points',
    'league.leader': 'Leader',
    'league.inviteCode': 'Invite code',
    'league.notifyMembers': 'Notify members',
    'league.pointsRace': 'Points Race',
    'league.rankings': 'Rankings',
    'league.notifyTitle': ({ name }) => `Notify ${name}`,
    'league.shareMessage': ({ name, code }) => `Join my WC 2026 prediction league "${name}"! Use invite code: ${code}`,

    'createLeague.name': 'League Name',
    'createLeague.placeholder': 'e.g. Office Champions',
    'createLeague.submit': 'Create League',
    'createLeague.required': 'Please enter a league name',
    'createLeague.successTitle': 'League Created!',
    'createLeague.inviteCode': ({ code }) => `Invite code: ${code}`,
    'createLeague.failed': 'Failed to create league',

    'joinLeague.inviteCode': 'Invite Code',
    'joinLeague.invalidCode': 'Invite code must be 6 characters',
    'joinLeague.successTitle': 'Joined!',
    'joinLeague.welcome': ({ name }) => `Welcome to ${name}`,
    'joinLeague.failed': 'Failed to join league',

    'match.notFound': 'Match not found',
    'match.predictionsTbd': 'Predictions open once both teams are confirmed.',
    'match.saved': 'Prediction saved!',
    'match.failedSave': 'Failed to save prediction',
    'match.yourPrediction': 'Your Prediction',
    'match.makePrediction': 'Make Your Prediction',
    'match.updatePrediction': 'Update Prediction',
    'match.submitPrediction': 'Submit Prediction',
    'match.locked': 'Predictions are locked for this match.',
    'match.bettingOdds': 'Betting odds',

    'matchCard.predict': 'Predict ->',
    'matchCard.teamsTbd': 'Teams TBD',
    'matchCard.predicted': 'Predicted',

    'predictionSheet.save': 'Save Prediction',

    'notify.title': 'Title',
    'notify.titlePlaceholder': 'Notification title',
    'notify.message': 'Message',
    'notify.messagePlaceholder': 'Write your message...',
    'notify.send': 'Send',

    'member.exact': 'Exact',
    'member.correct': 'Correct',
    'member.wrong': 'Wrong',
    'member.inLeague': ({ rank }) => `#${rank} in league`,
    'member.picksMade': 'Picks made',
    'member.pending': 'Pending',
    'member.latestPicks': 'Latest Picks',
    'member.pendingPicks': 'Pending Picks',
    'member.noPick': 'No pick',
    'member.sendReminder': 'Send reminder',
    'member.remind': ({ name }) => `Remind ${name}`,
    'member.heroNameYou': ({ name }) => `${name} (You)`,

    'tournament.picks': 'Tournament picks',
    'tournament.finalFour': 'Final Four',
    'tournament.individualAwards': 'Individual Awards',
    'tournament.winner': 'Tournament Winner',
    'tournament.runnerUp': 'Runner-up',
    'tournament.semiFinalist': 'Semi-finalist',
    'tournament.bestPlayer': 'Best Player - Golden Ball',
    'tournament.topScorer': 'Top Scorer - Golden Boot',
    'tournament.bestYoung': 'Best Young Player',
    'tournament.tapToSelect': 'Tap to select ->',
    'tournament.pickNationalTeam': 'Pick a national team',
    'tournament.searchTeam': 'Search team...',
    'tournament.searchPlayerTeam': 'Search player or team...',
  },
  es: {
    'common.admin': 'Admin',
    'common.cancel': 'Cancelar',
    'common.done': 'completado',
    'common.error': 'Error',
    'common.final': 'Final',
    'common.group': ({ group }) => `Grupo ${group}`,
    'common.inProgress': 'en curso',
    'common.language': 'Idioma',
    'common.live': 'EN VIVO',
    'common.member': 'Miembro',
    'common.missing': 'Falta',
    'common.notAvailable': 'No disponible',
    'common.ok': 'OK',
    'common.points': 'puntos',
    'common.pointsShort': 'pts',
    'common.rank': 'puesto',
    'common.share': 'Compartir',
    'common.you': 'Tú',
    'common.yourPick': 'tu pronóstico',
    'common.pick': 'pronóstico',
    'common.vs': 'vs',
    'common.tbd': 'P/D',
    'language.en': 'Inglés',
    'language.es': 'Español',

    'nav.home': 'Inicio',
    'nav.leagues': 'Ligas',
    'nav.predictions': 'Pronósticos',
    'nav.profile': 'Perfil',
    'nav.createLeague': 'Crear liga',
    'nav.joinLeague': 'Unirse a liga',
    'nav.match': 'Partido',

    'login.title': 'Polla Mundialista',
    'login.subtitle': 'FIFA 2026 · EE. UU. · Canadá · México',
    'login.email': 'Email',
    'login.password': 'Contraseña',
    'login.passwordPlaceholder': 'Tu contraseña',
    'login.continueEmail': 'Continuar con email',
    'login.or': 'o',
    'login.googleNotConfigured': 'Iniciar sesión con Google (no configurado)',
    'login.signingIn': 'Iniciando sesión...',
    'login.continueGoogle': 'Continuar con Google',
    'login.finePrint': 'Al continuar aceptas las reglas de la polla.\nTus pronósticos son visibles para otros miembros.',
    'login.required': 'Email y contraseña son obligatorios.',
    'login.passwordFailed': 'El inicio con email/contraseña falló. Revisa tus credenciales.',
    'login.signInFailed': 'No se pudo iniciar sesión. Inténtalo de nuevo.',
    'login.createAccount': '¿No tienes cuenta? Crear una',

    'register.title': 'Crear cuenta',
    'register.subtitle': 'FIFA 2026 · EE. UU. · Canadá · México',
    'register.name': 'Tu nombre',
    'register.namePlaceholder': 'Nombre que se muestra en ligas',
    'register.email': 'Email',
    'register.password': 'Contraseña',
    'register.passwordPlaceholder': 'Mín. 8 caracteres',
    'register.submit': 'Crear cuenta',
    'register.alreadyHaveAccount': '¿Ya tienes cuenta? Inicia sesión',
    'register.finePrint': 'Al crear una cuenta aceptas las reglas de la polla.\nTus pronósticos son visibles para otros miembros.',
    'register.required': 'Nombre, email y contraseña son obligatorios.',
    'register.passwordTooShort': 'La contraseña debe tener al menos 8 caracteres.',
    'register.emailTaken': 'Ya existe una cuenta con este email.',
    'register.failed': 'El registro falló. Inténtalo de nuevo.',

    'home.goodMorning': 'Buenos días',
    'home.goodAfternoon': 'Buenas tardes',
    'home.goodEvening': 'Buenas noches',
    'home.fan': 'Fan',
    'home.nextMatches': 'Próximos partidos',
    'home.leagues': 'Ligas',
    'home.recentResults': 'Resultados recientes',
    'home.noMatches': 'Todavía no hay partidos.',
    'home.fixturesSynced': 'El calendario aparecerá cuando se sincronice.',

    'leagues.privatePools': ({ count }) => `${count} ligas privadas`,
    'leagues.joinPrivatePool': 'Únete a una liga privada',
    'leagues.joinLeague': 'Unirse a liga',
    'leagues.noLeagues': 'Todavía no hay ligas.',
    'leagues.emptyHint': 'Únete a una liga para competir con amigos.',
    'leagues.players': ({ count }) => `${count} jugadores`,
    'leagues.playersWithPoints': ({ count, points }) => `${count} jugadores · ${points} pts`,

    'picks.title': 'Mis pronósticos',
    'picks.subtitle': 'Mundial FIFA 2026 · Fase de grupos',
    'picks.upcoming': 'Próximos',
    'picks.results': 'Resultados',
    'picks.groups': 'Grupos',
    'picks.finals': 'Finales',
    'picks.noUpcoming': 'No hay próximos partidos.',
    'picks.noResults': 'Todavía no hay resultados.',
    'picks.groupsPending': 'Los grupos aparecerán cuando los equipos estén confirmados.',
    'picks.groupStage': 'Fase de grupos',

    'profile.rankTag': ({ rank }) => `Puesto #${rank}`,
    'profile.matches': ({ count }) => `${count} partidos`,
    'profile.exactScores': 'Marcadores exactos',
    'profile.notifications': 'Notificaciones',
    'profile.pushNotifications': 'Notificaciones push',
    'profile.admin': 'Admin',
    'profile.notifyAll': 'Notificar a todos',
    'profile.account': 'Cuenta',
    'profile.editProfile': 'Editar perfil',
    'profile.displayName': 'Nombre visible',
    'profile.displayNamePlaceholder': 'Nombre que se muestra en ligas',
    'profile.saveName': 'Guardar nombre',
    'profile.nameRequired': 'El nombre visible es obligatorio.',
    'profile.nameTooLong': 'El nombre visible debe tener 40 caracteres o menos.',
    'profile.nameUpdated': 'Nombre visible actualizado.',
    'profile.nameUpdateFailed': 'No se pudo actualizar el nombre visible.',
    'profile.signOut': 'Cerrar sesión',

    'league.notFound': 'Liga no encontrada',
    'league.playersGroupStage': ({ count }) => `${count} jugadores · Fase de grupos`,
    'league.yourRank': 'Tu puesto',
    'league.yourPoints': 'Tus puntos',
    'league.leader': 'Líder',
    'league.inviteCode': 'Código de invitación',
    'league.notifyMembers': 'Notificar miembros',
    'league.pointsRace': 'Carrera de puntos',
    'league.rankings': 'Clasificación',
    'league.notifyTitle': ({ name }) => `Notificar a ${name}`,
    'league.shareMessage': ({ name, code }) => `Únete a mi liga de pronósticos WC 2026 "${name}". Usa el código: ${code}`,

    'createLeague.name': 'Nombre de la liga',
    'createLeague.placeholder': 'ej. Campeones de la oficina',
    'createLeague.submit': 'Crear liga',
    'createLeague.required': 'Introduce un nombre para la liga',
    'createLeague.successTitle': 'Liga creada',
    'createLeague.inviteCode': ({ code }) => `Código de invitación: ${code}`,
    'createLeague.failed': 'No se pudo crear la liga',

    'joinLeague.inviteCode': 'Código de invitación',
    'joinLeague.invalidCode': 'El código debe tener 6 caracteres',
    'joinLeague.successTitle': 'Te uniste',
    'joinLeague.welcome': ({ name }) => `Bienvenido a ${name}`,
    'joinLeague.failed': 'No se pudo unir a la liga',

    'match.notFound': 'Partido no encontrado',
    'match.predictionsTbd': 'Los pronósticos se abren cuando ambos equipos estén confirmados.',
    'match.saved': 'Pronóstico guardado',
    'match.failedSave': 'No se pudo guardar el pronóstico',
    'match.yourPrediction': 'Tu pronóstico',
    'match.makePrediction': 'Haz tu pronóstico',
    'match.updatePrediction': 'Actualizar pronóstico',
    'match.submitPrediction': 'Enviar pronóstico',
    'match.locked': 'Los pronósticos están cerrados para este partido.',
    'match.bettingOdds': 'Cuotas',

    'matchCard.predict': 'Pronosticar ->',
    'matchCard.teamsTbd': 'Equipos P/D',
    'matchCard.predicted': 'Pronosticado',

    'predictionSheet.save': 'Guardar pronóstico',

    'notify.title': 'Título',
    'notify.titlePlaceholder': 'Título de la notificación',
    'notify.message': 'Mensaje',
    'notify.messagePlaceholder': 'Escribe tu mensaje...',
    'notify.send': 'Enviar',

    'member.exact': 'Exacto',
    'member.correct': 'Correcto',
    'member.wrong': 'Incorrecto',
    'member.inLeague': ({ rank }) => `#${rank} en la liga`,
    'member.picksMade': 'Pronósticos hechos',
    'member.pending': 'Pendientes',
    'member.latestPicks': 'Últimos pronósticos',
    'member.pendingPicks': 'Pronósticos pendientes',
    'member.noPick': 'Sin pronóstico',
    'member.sendReminder': 'Enviar recordatorio',
    'member.remind': ({ name }) => `Recordar a ${name}`,
    'member.heroNameYou': ({ name }) => `${name} (Tú)`,

    'tournament.picks': 'Pronósticos del torneo',
    'tournament.finalFour': 'Final Four',
    'tournament.individualAwards': 'Premios individuales',
    'tournament.winner': 'Ganador del torneo',
    'tournament.runnerUp': 'Subcampeón',
    'tournament.semiFinalist': 'Semifinalista',
    'tournament.bestPlayer': 'Mejor jugador - Balón de Oro',
    'tournament.topScorer': 'Máximo goleador - Bota de Oro',
    'tournament.bestYoung': 'Mejor jugador joven',
    'tournament.tapToSelect': 'Toca para elegir ->',
    'tournament.pickNationalTeam': 'Elige una selección',
    'tournament.searchTeam': 'Buscar equipo...',
    'tournament.searchPlayerTeam': 'Buscar jugador o equipo...',
  },
};

interface I18nContextValue {
  language: Language;
  setLanguage: (language: Language) => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
  locale: string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => getDeviceLanguage());

  useEffect(() => {
    setApiLanguage(language);
    getToken(LANGUAGE_STORAGE_KEY).then((saved) => {
      if (saved === 'en' || saved === 'es') {
        setLanguageState(saved);
        setApiLanguage(saved);
        return;
      }

      setToken(LANGUAGE_STORAGE_KEY, language).catch(() => {});
    });
  }, []);

  const value = useMemo<I18nContextValue>(() => {
    const setLanguage = async (nextLanguage: Language) => {
      setLanguageState(nextLanguage);
      setApiLanguage(nextLanguage);
      await setToken(LANGUAGE_STORAGE_KEY, nextLanguage);
    };

    const t = (key: string, params: Record<string, string | number> = {}) => {
      const valueForKey = translations[language][key] ?? translations.en[key] ?? key;
      return typeof valueForKey === 'function' ? valueForKey(params) : valueForKey;
    };

    return {
      language,
      setLanguage,
      t,
      locale: language === 'es' ? 'es-ES' : 'en-US',
    };
  }, [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used inside I18nProvider');
  }

  return context;
}
