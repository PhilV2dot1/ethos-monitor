# Ethos Monitor - BOT Anti-Slash

Un systeme complet de surveillance des reviews negatives sur Ethos Network avec alertes instantanees et defense automatique.

## Fonctionnalites

- **Surveillance automatique** des reviews recues par vos relations (vouches)
- **Detection des reviews negatives** (score < 0) et des slashes
- **Alertes multi-canaux** : Telegram, Discord, X/Twitter
- **Auto-defense avec confirmation** : proposition de review positive pre-remplie
- **Dashboard web** pour visualiser et gerer les alertes
- **Historique complet** des reviews et defenses

## Architecture

```
ethos-monitor/
├── backend/          # API Node.js + Express + Prisma
│   ├── src/
│   │   ├── services/     # Ethos API, Monitor, Alertes
│   │   ├── routes/       # REST API endpoints
│   │   ├── scheduler/    # Cron jobs
│   │   └── config/       # Configuration
│   └── prisma/           # Schema SQLite
│
├── frontend/         # Dashboard Next.js + Tailwind
│   └── src/
│       ├── app/          # Pages (dashboard, relations, alerts, defend)
│       ├── components/   # Composants React
│       └── lib/          # Client API
│
└── docker-compose.yml
```

## Installation Rapide

### Prerequis

- Node.js 18+
- npm ou yarn
- Compte Ethos Network

### 1. Cloner et configurer

```bash
# Cloner le repo
git clone <repo-url>
cd ethos-monitor

# Backend
cd backend
npm install
cp .env.example .env
# Editer .env avec vos credentials (voir section ci-dessous)

# Initialiser la base de donnees
npx prisma db push
npx prisma generate

# Frontend
cd ../frontend
npm install
cp .env.local.example .env.local
```

### 2. Configurer les credentials

Editez `backend/.env` avec vos informations :

```env
# Ethos (obligatoire)
ETHOS_PRIVY_TOKEN=votre_token_privy
ETHOS_USER_KEY=profileId:12345

# Telegram (recommande)
TELEGRAM_BOT_TOKEN=votre_bot_token
TELEGRAM_CHAT_ID=votre_chat_id

# Discord (optionnel)
DISCORD_WEBHOOK_URL=votre_webhook_url
```

### 3. Demarrer

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

Ouvrir http://localhost:3000 pour le dashboard.

## Obtenir vos Credentials

### Ethos Privy Token

1. Aller sur https://app.ethos.network et se connecter
2. Ouvrir DevTools (F12) > Application > Cookies
3. Copier la valeur du cookie `privy-token`

**Note**: Ce token expire apres 1 heure. Pour une utilisation continue, vous devrez le rafraichir regulierement.

### Ethos User Key

Formats acceptes :
- `profileId:12345` - Votre ID de profil
- `address:0x1234...abcd` - Votre adresse Ethereum
- `service:x.com:username:votre_handle` - Via X/Twitter

Pour trouver votre profileId, allez sur votre profil Ethos.

### Telegram Bot

1. Ouvrir Telegram et chercher `@BotFather`
2. Envoyer `/newbot` et suivre les instructions
3. Copier le token fourni
4. Demarrer une conversation avec votre bot
5. Ouvrir `https://api.telegram.org/bot<TOKEN>/getUpdates`
6. Trouver votre Chat ID dans la reponse

### Discord Webhook

1. Parametres du serveur > Integrations > Webhooks
2. Creer un nouveau webhook
3. Copier l'URL

## API REST

| Endpoint | Methode | Description |
|----------|---------|-------------|
| `/health` | GET | Status du systeme |
| `/api/stats` | GET | Statistiques globales |
| `/api/relations` | GET | Liste des relations |
| `/api/reviews` | GET | Liste des reviews |
| `/api/reviews/negative` | GET | Reviews negatives |
| `/api/alerts` | GET | Liste des alertes |
| `/api/alerts/pending` | GET | Alertes en attente |
| `/api/defend` | POST | Poster une defense |
| `/api/defend/confirm/:id` | POST | Confirmer auto-defense |
| `/api/monitor/run` | POST | Declencher un scan |
| `/api/monitor/status` | GET | Status du monitor |

## Format des Alertes

### Telegram

```
🚨 ALERTE ETHOS - REVIEW NÉGATIVE

📛 Cible: @username (0x1234...abcd)
👤 Attaquant: @attacker (0x5678...efgh)
⭐ Score: -2
💬 Commentaire: "Scam project, avoid!"

🔗 Profil: https://app.ethos.network/profile/...
⏰ Détecté: 2026-01-19 14:30:00

━━━━━━━━━━━━━━━━━━━━━━
🤖 Auto-défense proposée:
"Trusted and reliable community member."
━━━━━━━━━━━━━━━━━━━━━━

[✅ Confirmer] [✏️ Modifier] [❌ Ignorer]
```

## Docker

```bash
# Build et demarrer
docker-compose up -d

# Voir les logs
docker-compose logs -f

# Arreter
docker-compose down
```

## Variables d'environnement

### Backend

| Variable | Description | Defaut |
|----------|-------------|--------|
| `PORT` | Port du serveur | 3001 |
| `ETHOS_API_URL` | URL de l'API Ethos | https://api.ethos.network |
| `ETHOS_PRIVY_TOKEN` | Token d'authentification | - |
| `ETHOS_USER_KEY` | Votre identifiant Ethos | - |
| `TELEGRAM_BOT_TOKEN` | Token du bot Telegram | - |
| `TELEGRAM_CHAT_ID` | ID du chat Telegram | - |
| `DISCORD_WEBHOOK_URL` | URL du webhook Discord | - |
| `MONITOR_INTERVAL_MINUTES` | Intervalle de scan | 5 |
| `AUTO_DEFENSE_ENABLED` | Activer auto-defense | true |
| `AUTO_DEFENSE_REQUIRE_CONFIRM` | Demander confirmation | true |

### Frontend

| Variable | Description | Defaut |
|----------|-------------|--------|
| `NEXT_PUBLIC_API_URL` | URL du backend | http://localhost:3001 |

## Securite

- Les tokens sont stockes dans `.env` (non versione)
- CORS configure pour le frontend uniquement
- Rate limiting respecte pour l'API Ethos
- Validation des inputs avec Zod

## Ameliorations possibles

1. **Webhooks Ethos** - Remplacer le polling si disponible
2. **Multi-utilisateurs** - Support plusieurs comptes
3. **Analytics avances** - Graphiques, export CSV
4. **Mobile app** - Version React Native
5. **Intelligence** - Score de gravite des attaques

## Troubleshooting

### Token expire

Si vous recevez des erreurs 401, votre Privy token a expire. Reconnectez-vous a Ethos et copiez le nouveau token.

### Pas d'alertes recues

1. Verifiez que `TELEGRAM_BOT_TOKEN` et `TELEGRAM_CHAT_ID` sont corrects
2. Assurez-vous d'avoir demarre une conversation avec votre bot
3. Verifiez les logs du backend pour les erreurs

### Base de donnees corrompue

```bash
cd backend
rm prisma/ethos.db
npx prisma db push
```

## Licence

MIT

## Support

Pour toute question ou probleme, ouvrez une issue sur le repo.
