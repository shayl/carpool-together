"use client";

import {
  createContext,
  useCallback,
  type ReactNode,
  useContext,
  useEffect,
  useSyncExternalStore,
} from "react";

type Locale = "en" | "he";
type Replacements = Record<string, string | number>;

export const hebrew: Record<string, string> = {
  "Pull to refresh": "משכו לרענון",
  "Release to refresh": "שחררו לרענון",
  "Refreshing…": "מרעננים…",
  "Refresh schedule": "רענון לוח הזמנים",
  "Schedule refreshed.": "לוח הזמנים רוענן.",
  "Sample schedule reset. No backend requests.": "לוח הזמנים לדוגמה אופס. לא נשלחו בקשות לשרת.",
  "You're offline. Reconnect to refresh.": "אין חיבור לרשת. התחברו מחדש כדי לרענן.",
  "Finish or discard your changes before refreshing.": "סיימו או בטלו את השינויים לפני הרענון.",
  "Could not refresh the schedule. Try again.": "לא ניתן לרענן את לוח הזמנים. נסו שוב.",
  Schedule: "לוח זמנים",
  People: "חברים",
  Places: "מקומות",
  "Edit event": "עריכת אירוע",
  "Edit break": "עריכת הפסקה",
  "Earlier this week": "מוקדם יותר השבוע",
  "Calendar options": "אפשרויות לוח השנה",
  "A little planning. A smoother week.": "קצת תכנון. שבוע רגוע יותר.",
  "A single date for your group.": "אירוע בתאריך אחד לקבוצה שלכם.",
  "Add an adult to a household before assigning a driver.": "יש להוסיף מבוגר למשפחה לפני בחירת נהג.",
  "Add event": "הוספת אירוע",
  "Change plans": "שינוי התוכניות",
  "Choose a driver": "בחירת נהג",
  "Choose another driver": "בחירת נהג אחר",
  "Assign driver": "שיבוץ נהג",
  "I'll drive": "אני אסיע",
  "We're driving": "אנחנו מסיעים",
  "Next up": "האירוע הבא",
  "Save plans": "שמירת התוכניות",
  "Riders & details": "נוסעים ופרטים",
  "Hide details": "הסתרת פרטים",
  "Riders & pickup addresses": "נוסעים וכתובות איסוף",
  "Open month view": "פתיחת תצוגה חודשית",
  "Open week view": "פתיחת תצוגה שבועית",
  "Month view": "תצוגה חודשית",
  "Week view": "תצוגה שבועית",
  "No rides match this filter": "אין נסיעות התואמות לסינון",
  "A quiet week": "שבוע רגוע",
  "Try All to see the full schedule.": "בחרו בהכול כדי לראות את לוח הזמנים המלא.",
  "Events will appear here when your group adds them.": "אירועים יופיעו כאן כשהקבוצה תוסיף אותם.",
  "Driving balance": "חלוקת ההסעות",
  "Driving totals will appear when families join.": "סיכומי ההסעות יופיעו כשמשפחות יצטרפו.",
  "Each direction counts as one drive. Share the effort over time.": "כל כיוון נחשב להסעה אחת. מתחלקים במאמץ לאורך זמן.",
  "Group appearance, invitations & access": "מראה הקבוצה, הזמנות וגישה",
  "Group management": "ניהול הקבוצה",
  Groups: "קבוצות",
  "Help & privacy": "עזרה ופרטיות",
  "How often does your group meet?": "באיזו תדירות הקבוצה נפגשת?",
  Language: "שפה",
  "Language, theme, notifications & install": "שפה, עיצוב, התראות והתקנה",
  "Make yourself at home.": "התאימו את האפליקציה אליכם.",
  Navigate: "ניווט",
  "No events this week. Your family plans are up to date.": "אין אירועים השבוע. התוכניות של המשפחה מעודכנות.",
  "No upcoming events. Add the next date when you're ready.": "אין אירועים קרובים. אפשר להוסיף את התאריך הבא כשמוכנים.",
  Preferences: "העדפות",
  "Quick answers and important information": "תשובות מהירות ומידע חשוב",
  "Release {{direction}} driven by {{name}}? The ride will need a driver.": "לבטל את ההסעה {{direction}} של {{name}}? יהיה צורך בנהג.",
  "Repeat on the same day each week.": "חזרה באותו יום בכל שבוע.",
  "Small tasks. Shared effort.": "משימות קטנות. מאמץ משותף.",
  "Switch, join or create a group": "מעבר, הצטרפות או יצירת קבוצה",
  "Team tasks": "משימות הקבוצה",
  "To change the driver, release this ride, then choose another driver.": "כדי להחליף נהג, בטלו את השיבוץ ואז בחרו נהג אחר.",
  "Your people, their families, and pickup details.": "חברי הקבוצה, המשפחות ופרטי האיסוף.",
  "{{count}} drives": "{{count}} הסעות",
  "Choose Change plans on Rides, or select an event in My family. Attendance, ride there, and ride home are separate choices.": "בחרו שינוי התוכניות בנסיעות, או בחרו אירוע במשפחה שלי. נוכחות, הסעה הלוך והסעה חזור הן בחירות נפרדות.",
  "Could not connect to live updates. Refresh to see the latest schedule.": "לא ניתן להתחבר לעדכונים חיים. רעננו כדי לראות את לוח הזמנים העדכני.",
  "Account actions are disabled in the local demo.": "פעולות חשבון אינן זמינות בהדגמה המקומית.",
  "Local demo · sample data only": "הדגמה מקומית · נתונים לדוגמה בלבד",
  "Ride claims and family plans work in memory. Reload to reset. No database changes.": "שיבוצי נהגים ותוכניות משפחתיות נשמרים בזיכרון בלבד. רענון מאפס אותם. אין שינויים במסד הנתונים.",
  "Demo updated. Changes last until you reload.": "ההדגמה עודכנה. השינויים נשמרים עד לרענון.",
  "Demo: organizer, address, and account saves are disabled. Try ride claims and family plans.": "הדגמה: שמירת פעולות ניהול, כתובות וחשבון אינה זמינה. אפשר לנסות שיבוצי נהגים ותוכניות משפחתיות.",
  "Map lookup is disabled for demo addresses.": "חיפוש במפה אינו זמין לכתובות לדוגמה.",
  "Navigation is disabled for demo addresses.": "ניווט אינו זמין לכתובות לדוגמה.",
  "Notifications and installation are available in the live app, not this local demo.": "התראות והתקנה זמינות באפליקציה האמיתית, ולא בהדגמה המקומית.",
  "App and notifications": "אפליקציה והתראות",
  "Group invitation": "הזמנה לקבוצה",
  "Share group": "שיתוף הקבוצה",
  "Send this group's app link and current PIN to your WhatsApp group.":
    "שלחו לקבוצת ה-WhatsApp את הקישור לאפליקציה ואת קוד ה-PIN הנוכחי.",
  "The current group PIN is added securely when you share.":
    "קוד ה-PIN הנוכחי של הקבוצה נוסף באופן מאובטח בעת השיתוף.",
  "Preparing invitation…": "מכינים הזמנה…",
  "Copy invitation": "העתקת ההזמנה",
  "Invitation copied": "ההזמנה הועתקה",
  "Invitation copied.": "ההזמנה הועתקה.",
  "Could not copy the invitation. Select WhatsApp instead.":
    "לא ניתן להעתיק את ההזמנה. בחרו במקום זאת ב-WhatsApp.",
  "Share on WhatsApp": "שיתוף ב-WhatsApp",
  "WhatsApp opened. Choose your group chat to send the invitation.":
    "WhatsApp נפתח. בחרו את הצ'אט הקבוצתי שאליו תרצו לשלוח את ההזמנה.",
  "Join {{group}} on Carpool Together!\n\nOpen the app: {{url}}\nGroup PIN: {{pin}}":
    "הצטרפו ל-{{group}} ב-Carpool Together!\n\nפתחו את האפליקציה: {{url}}\nקוד PIN לקבוצה: {{pin}}",
  "Install app": "התקנת האפליקציה",
  "Help and information": "עזרה ומידע",
  Help: "עזרה",
  "Quick answers for planning and driving carpools.":
    "תשובות מהירות לתכנון ולביצוע הסעות.",
  "Using rides, attendance, notifications, and maps.":
    "שימוש בנסיעות, נוכחות, התראות ומפות.",
  "Add Carpool Together to your Home Screen for quick, full-screen access.":
    "הוסיפו את Carpool Together למסך הבית לגישה מהירה במסך מלא.",
  "Installed. Carpool Together opens from your Home Screen.":
    "האפליקציה מותקנת וניתן לפתוח אותה ממסך הבית.",
  "Installation started. Open Carpool Together from its new app icon.":
    "ההתקנה החלה. פתחו את Carpool Together מהסמל החדש.",
  "Installation was canceled. You can try again anytime.":
    "ההתקנה בוטלה. אפשר לנסות שוב בכל עת.",
  "Open this page in Safari.": "פתחו את הדף הזה ב-Safari.",
  "Tap Share.": "לחצו על שיתוף.",
  "Choose Add to Home Screen, then tap Add.":
    "בחרו הוספה למסך הבית ואז לחצו על הוספה.",
  "Open your browser menu and choose Install app or Add to Home screen.":
    "פתחו את תפריט הדפדפן ובחרו התקנת אפליקציה או הוספה למסך הבית.",
  "Rides and drivers": "נסיעות ונהגים",
  "Open an event on Rides to see each required direction. A happy car means every ride has a driver; a sad car means at least one still needs help.":
    "פתחו אירוע בנסיעות כדי לראות כל כיוון נדרש. רכב שמח אומר שלכל נסיעה יש נהג; רכב עצוב אומר שלפחות נסיעה אחת עדיין זקוקה לעזרה.",
  "Attendance and absences": "נוכחות והיעדרויות",
  "Tap a member avatar on an event to change that day. Use My family to add a multi-day absence.":
    "לחצו על תמונת חבר באירוע כדי לשנות את אותו יום. השתמשו במשפחה שלי כדי להוסיף היעדרות למספר ימים.",
  "Maps and routes": "מפות ומסלולים",
  "Open an assigned ride to launch Google Maps, Apple Maps, or Waze. Group members can see household addresses needed for pickups.":
    "פתחו נסיעה ששובצה כדי להפעיל את Google Maps, Apple Maps או Waze. חברי הקבוצה יכולים לראות את כתובות המשפחות הנדרשות לאיסוף.",
  "Install and notifications": "התקנה והתראות",
  "Install Carpool Together from Settings for quick Home Screen access. Each adult can enable reminders on their own device.":
    "התקינו את Carpool Together מההגדרות לגישה מהירה ממסך הבית. כל מבוגר יכול להפעיל תזכורות במכשיר שלו.",
  "Something looks out of date": "משהו לא מעודכן",
  "Check that this device is online, then refresh the app. Confirm the event date and member status before changing it again.":
    "ודאו שהמכשיר מחובר לאינטרנט ורעננו את האפליקציה. בדקו את תאריך האירוע ומצב החבר לפני שינוי נוסף.",
  "Driver reminders": "תזכורות לנהגים",
  "Each adult chooses a reminder time on every device. Reminders are sent only for rides their family is driving.":
    "כל מבוגר בוחר זמן תזכורת בכל מכשיר. תזכורות נשלחות רק לנסיעות שהמשפחה שלו מסיעה.",
  "This browser does not support app notifications.":
    "הדפדפן הזה אינו תומך בהתראות אפליקציה.",
  "On iPhone and iPad, install the app first, then open it from the Home Screen.":
    "ב-iPhone וב-iPad יש להתקין תחילה את האפליקציה ואז לפתוח אותה ממסך הבית.",
  "Notifications are blocked. Enable them in this device's settings.":
    "ההתראות חסומות. הפעילו אותן בהגדרות המכשיר.",
  "Remind me before pickup": "הזכירו לי לפני האיסוף",
  "Enable reminders": "הפעלת תזכורות",
  "Enabling…": "מפעילים…",
  "Send test": "שליחת בדיקה",
  "Disable on this device": "השבתה במכשיר הזה",
  "Driver reminders are enabled on this device.":
    "תזכורות לנהגים מופעלות במכשיר הזה.",
  "Reminders are disabled on this device.":
    "התזכורות מושבתות במכשיר הזה.",
  "Test reminder sent. Check this device's notifications.":
    "נשלחה תזכורת לבדיקה. בדקו את ההתראות במכשיר.",
  "This device will remind you {{lead}} before pickup.":
    "המכשיר יזכיר לכם {{lead}} לפני האיסוף.",
  "Could not check reminder status.": "לא ניתן לבדוק את מצב התזכורות.",
  "Could not enable reminders.": "לא ניתן להפעיל תזכורות.",
  "Could not change reminder time.": "לא ניתן לשנות את זמן התזכורת.",
  "Could not send a test reminder.": "לא ניתן לשלוח תזכורת לבדיקה.",
  "Could not disable reminders.": "לא ניתן להשבית תזכורות.",
  "Driver reminders are not configured yet.":
    "תזכורות לנהגים עדיין אינן מוגדרות.",
  "This device is not subscribed.": "המכשיר הזה אינו רשום להתראות.",
  "Enable reminders on this device first.":
    "הפעילו תחילה תזכורות במכשיר הזה.",
  "The test reminder could not be delivered.":
    "לא ניתן היה למסור את תזכורת הבדיקה.",
  "Reminder dispatcher authorization failed.":
    "אימות שירות שליחת התזכורות נכשל.",
  "Reconnect before enabling reminders.":
    "התחברו מחדש לאינטרנט לפני הפעלת תזכורות.",
  "Reconnect before changing reminder time.":
    "התחברו מחדש לאינטרנט לפני שינוי זמן התזכורת.",
  "Add the app to your Home Screen and open it from the icon before enabling reminders.":
    "הוסיפו את האפליקציה למסך הבית ופתחו אותה מהסמל לפני הפעלת התזכורות.",
  "Notifications are blocked in this device's settings.":
    "ההתראות חסומות בהגדרות המכשיר.",
  "Notification permission was not granted.": "לא ניתנה הרשאה להתראות.",
  "Notification settings could not be updated.":
    "לא ניתן לעדכן את הגדרות ההתראות.",
  "15 minutes": "15 דקות",
  "30 minutes": "30 דקות",
  "1 hour": "שעה",
  "1 hour 30 minutes": "שעה ו-30 דקות",
  "2 hours": "שעתיים",
  "Skip to content": "דלגו לתוכן",
  "Active group": "קבוצה פעילה",
  "Sign out": "התנתקות",
  "{{group}} Carpool": "הסעות {{group}}",
  "Main navigation": "ניווט ראשי",
  Rides: "נסיעות",
  "My family": "המשפחה שלי",
  Team: "הקבוצה",
  Settings: "הגדרות",
  "A little teamwork. Every ride.": "קצת עבודת צוות. בכל נסיעה.",
  "No events scheduled": "אין אירועים מתוכננים",
  "Event and ride planning will appear here after an organizer creates the group schedule.":
    "תכנון האירועים והנסיעות יופיע כאן לאחר שמארגן ייצור לוח זמנים לקבוצה.",
  "Week navigation": "ניווט בין שבועות",
  "Previous week": "השבוע הקודם",
  "Next week": "השבוע הבא",
  "This week": "השבוע",
  "Sep 21 – Sep 27": "21–27 בספטמבר",
  "Thu 24": "ה׳ 24",
  "5:30 PM": "17:30",
  "Every ride has a seat": "לכל נוסע יש מקום",
  "{{count}} rides need help": "{{count}} נסיעות עדיין זקוקות לעזרה",
  "{{covered}} of {{total}} covered":
    "{{covered}} מתוך {{total}} קיבלו סידור",
  "Ride filters": "סינון נסיעות",
  All: "הכול",
  "Needs a family": "זקוקים למשפחה מסיעה",
  Covered: "מסודר",
  "Needs a driver": "דרוש נהג",
  "Homeward ride": "נסיעה הביתה",
  "{{riders}} riders · {{seats}} seats offered":
    "{{riders}} נוסעים · {{seats}} מקומות הוצעו",
  "Planning…": "מתכננים…",
  "Suggest carpools": "הציעו שיבוצים",
  seat: "מקום",
  seats: "מקומות",
  "Suggested plan": "שיבוץ מוצע",
  "Draft until each driver accepts": "טיוטה עד לאישור של כל נהג",
  "No pickup needed": "אין צורך באיסוף",
  "+{{miles}} mi estimated · {{seats}} seats left":
    "תוספת משוערת של {{miles}} מייל · נותרו {{seats}} מקומות",
  "Still needs a seat:": "עדיין זקוקים למקום:",
  "Unable to plan rides.": "לא ניתן לתכנן את הנסיעות.",
  "Your riders, your plans.": "הנוסעים והתוכניות שלכם.",
  "{{name}} family": "משפחת {{name}}",
  "Week of {{date}}": "השבוע של {{date}}",
  "Change a daily ride": "שינוי נסיעה יומית",
  "Rider absences": "היעדרויות נוסעים",
  "Applies to scheduled events. Only your family can change these dates.":
    "חל על אירועים מתוכננים. רק המשפחה שלכם יכולה לשנות את התאריכים האלה.",
  "Show past dates": "הצגת תאריכים קודמים",
  "Hide past dates": "הסתרת תאריכים קודמים",
  "Family details": "פרטי המשפחה",
  "Edit family details": "עריכת פרטי המשפחה",
  "Hide family details": "הסתרת פרטי המשפחה",
  "Discard your unsaved changes?": "לבטל את השינויים שלא נשמרו?",
  "Close {{title}}": "סגירת {{title}}",
  "Family name": "שם המשפחה",
  "Parent / guardian": "הורה / אפוטרופוס",
  "This guardian is required for your active account.":
    "האפוטרופוס הזה נדרש עבור החשבון הפעיל שלכם.",
  "A protected guardian cannot be removed.":
    "לא ניתן להסיר אפוטרופוס מוגן.",
  "A submitted rider does not belong to this household.":
    "הנוסע שנשלח אינו שייך למשק הבית הזה.",
  "Remove guardian": "הסרת אפוטרופוס",
  Phone: "טלפון",
  Rider: "נוסע",
  "+ Guardian": "+ אפוטרופוס",
  "+ Rider": "+ נוסע",
  "Save family changes": "שמירת השינויים במשפחה",
  "Choose with map pin": "בחירה באמצעות סיכה במפה",
  "Choose home location": "בחירת מיקום הבית",
  "Choose venue location": "בחירת מיקום המקום",
  "Tap the map or drag the pin": "הקישו על המפה או גררו את הסיכה",
  "Use current location": "שימוש במיקום הנוכחי",
  "Finding street address…": "מאתרים כתובת רחוב…",
  "Tap a location on the map.": "הקישו על מיקום במפה.",
  "Use this address": "שימוש בכתובת הזו",
  "We could not locate the typed address. Tap the map to choose it.":
    "לא הצלחנו לאתר את הכתובת שהוקלדה. הקישו על המפה כדי לבחור אותה.",
  "Could not find the address.": "לא ניתן למצוא את הכתובת.",
  "Location services are not available on this device.":
    "שירותי מיקום אינם זמינים במכשיר הזה.",
  "Allow location access to use your current position.":
    "אפשרו גישה למיקום כדי להשתמש במיקום הנוכחי שלכם.",
  "The map service could not resolve this location.":
    "שירות המפות לא הצליח לזהות את המיקום הזה.",
  "No street address was found at that location.":
    "לא נמצאה כתובת רחוב במיקום הזה.",
  "Invalid map location.": "מיקום המפה אינו תקין.",
  "The map service is temporarily unavailable.":
    "שירות המפות אינו זמין זמנית.",
  "Offline — showing saved information. Reconnect to make changes or open a route.":
    "אין חיבור — מוצג מידע שמור. התחברו מחדש כדי לבצע שינויים או לפתוח מסלול.",
  "Reconnect to make changes.": "התחברו מחדש כדי לבצע שינויים.",
  "Could not add the venue.": "לא ניתן להוסיף את המקום.",
  "No riders in this family yet": "עדיין אין נוסעים במשפחה הזו",
  "Use Edit family details to add the first rider.":
    "השתמשו בעריכת פרטי המשפחה כדי להוסיף את הנוסע הראשון.",
  Family: "משפחה",
  "No rider yet": "עדיין אין נוסע",
  "Thursday practice": "אימון ביום חמישי",
  "Homeward ride requested": "התבקשה נסיעה הביתה",
  "The people who keep everyone moving.": "האנשים שעוזרים לכולם להגיע.",
  "Group roster": "רשימת חברי הקבוצה",
  "{{count}} people": "{{count}} אנשים",
  "Phone hidden": "מספר הטלפון מוסתר",
  owner: "בעלים",
  "Make organizer": "מינוי כמנהל",
  "Make {{name}} an organizer?": "למנות את {{name}} כמנהל?",
  admin: "מנהל",
  coordinator: "רכז",
  member: "חבר",
  "Add members": "הוספת חברים",
  "Add people to the group": "הוספת אנשים לקבוצה",
  "Add one person or import several at once.":
    "הוסיפו אדם אחד או ייבאו כמה אנשים בבת אחת.",
  "Add one person": "הוספת אדם",
  "Bulk import": "ייבוא מרובה",
  Name: "שם",
  Role: "תפקיד",
  "Add person": "הוספת אדם",
  "Import people": "ייבוא אנשים",
  "Could not add the person.": "לא ניתן להוסיף את האדם.",
  Absent: "נעדרים",
  "Add absence": "הוספת היעדרות",
  "Add an event from the Team tab.": "הוסיפו אירוע מלשונית הקבוצה.",
  "Add break": "הוספת הפסקה",
  "Add one-time events or recurring weekly events.":
    "הוסיפו אירועים חד-פעמיים או אירועים שבועיים קבועים.",
  "Add venue": "הוספת מקום",
  Driver: "נהג/ת",
  "That driver is not available.": "הנהג/ת אינו/ה זמין/ה.",
  "Drivers in this household": "הנהגים במשק הבית הזה",
  "Every driver here can claim and drive this household's rides.":
    "כל נהג/ת כאן יכול/ה לקחת ולנהוג בנסיעות של משק הבית.",
  "Riders in this household": "הנוסעים במשק הבית הזה",
  "The kids who need rides. Every parent in the household shares driving responsibility.":
    "הילדים שצריכים הסעות. כל ההורים במשק הבית חולקים את אחריות הנהיגה.",
  "Add a rider": "הוספת נוסע/ת",
  "Add rider": "הוסיפו נוסע/ת",
  "Rider name": "שם הנוסע/ת",
  "Enter a rider name.": "הזינו שם נוסע/ת.",
  "Invalid rider details.": "פרטי נוסע/ת שגויים.",
  "Rider not found in your household.": "הנוסע/ת לא נמצא/ה במשק הבית שלכם.",
  "Remove {{name}} from this household?": "להסיר את {{name}} ממשק הבית הזה?",
  "Combine households": "איחוד משקי בית",
  Households: "משקי בית",
  "Actions for {{name}}": "פעולות עבור {{name}}",
  "Join {{household}}": "צירוף ל{{household}}",
  "Move out": "הוצאה ממשק הבית",
  "Remove {{name}} from the group? Their past rides are kept.":
    "להסיר את {{name}} מהקבוצה? הנסיעות הקודמות יישמרו.",
  "Also delete {{name}} permanently? This cannot be undone.":
    "למחוק את {{name}} לגמרי? לא ניתן לבטל את הפעולה.",
  "This person has driven rides. Remove them instead of deleting.":
    "האדם הזה ביצע נסיעות. הסירו אותו במקום למחוק.",
  "Choose who to move and where.": "בחרו את מי להעביר ולאן.",
  "Who lives together, their pickup address, and how much they have driven.":
    "מי גר יחד, כתובת האיסוף, וכמה נסיעות ביצעו.",
  "Select everyone who lives together — parents, a grandparent, an older sibling who drives — and combine them into one household.":
    "בחרו את כל מי שגר יחד — הורים, סבא או סבתא, אח או אחות בוגרים שנוהגים — ואחדו אותם למשק בית אחד.",
  "Combine {{count}} members": "איחוד {{count}} חברים",
  "Choose at least two members to combine.": "בחרו לפחות שני חברים לאיחוד.",
  "Combine these members into one household? They will share riders, rides, and driving responsibility.":
    "לאחד את החברים האלה למשק בית אחד? הם יחלקו נוסעים, נסיעות ואחריות נהיגה.",
  "Role for {{name}}": "תפקיד עבור {{name}}",
  "Could not change the role.": "לא ניתן לשנות את התפקיד.",
  "Choose a valid role.": "בחרו תפקיד תקין.",
  "A group needs at least one owner.": "לקבוצה נדרש לפחות בעלים אחד.",
  "Put two members in one household so they share the same riders and rides.":
    "שימו שני חברים במשק בית אחד כדי שיחלקו את אותם נוסעים ונסיעות.",
  "Choose two different members.": "בחרו שני חברים שונים.",
  "Choose two different members to combine.": "בחרו שני חברים שונים לאיחוד.",
  "Combine these members into one household? They will share rides and driving responsibility.":
    "לאחד את החברים האלה למשק בית אחד? הם יחלקו נסיעות ואחריות נהיגה.",
  "Could not combine households.": "לא ניתן לאחד את משקי הבית.",
  "Member": "חבר/ה",
  "Choose member": "בחרו חבר/ה",
  "Into household of": "אל משק הבית של",
  "Combine": "איחוד",
  "Member not found in this group.": "החבר/ה לא נמצא/ה בקבוצה זו.",
  "One of these members has no household.": "לאחד מהחברים אין משק בית.",
  "These members already share a household.": "החברים האלה כבר חולקים משק בית.",
  "Start typing an address": "התחילו להקליד כתובת",
  "Location confirmed on the map.": "המיקום אומת במפה.",
  contributors: "תורמי",
  "Address suggestions and map routing use OpenStreetMap data. Address text you type is sent to the OpenStreetMap-based geocoding service to return matching suggestions. Map data is © OpenStreetMap contributors, available under the Open Database License.":
    "הצעות הכתובות וניתוב המפות מבוססים על נתוני OpenStreetMap. טקסט הכתובת שאתם מקלידים נשלח לשירות הגיאוקודינג המבוסס על OpenStreetMap כדי להחזיר הצעות מתאימות. נתוני המפה הם © תורמי OpenStreetMap, וזמינים תחת רישיון Open Database License.",
  Venues: "מקומות",
  "Places your events meet. Open one to see it on a map.":
    "המקומות שבהם מתקיימים האירועים. פתחו מקום כדי לראות אותו במפה.",
  "No venues yet.": "עדיין אין מקומות.",
  "Open in maps": "פתיחה במפות",
  Share: "שיתוף",
  "Sharing…": "משתפים…",
  "Share link copied.": "קישור השיתוף הועתק.",
  "Choose a venue to share.": "בחרו מקום לשיתוף.",
  "Add a venue shared with you": "הוספת מקום ששותף אתכם",
  "Paste a venue share link": "הדביקו קישור לשיתוף מקום",
  "Add shared venue": "הוספת המקום המשותף",
  "You get your own copy to edit. Adding the same link again restores the original details.":
    "תקבלו עותק משלכם לעריכה. הוספה חוזרת של אותו קישור תשחזר את הפרטים המקוריים.",
  "Invalid share link.": "קישור שיתוף שגוי.",
  "This share link is no longer available.": "קישור השיתוף אינו זמין יותר.",
  "At least one venue field is required.": "נדרש למלא לפחות שדה אחד של המקום.",
  Address: "כתובת",
  "Home address": "כתובת הבית",
  "Used only to coordinate pickups and routes within your group.":
    "משמשת רק לתיאום איסופים ומסלולים בתוך הקבוצה שלכם.",
  "123 Main St, City": "רחוב הדוגמה 123, עיר",
  "Save address": "שמירת הכתובת",
  "All rides covered": "לכל הנסיעות יש נהג",
  "All rides have drivers": "לכל הנסיעות יש נהגים",
  "{{name}} is driving": "{{name}} מסיעים",
  "{{names}} are driving": "{{names}} מסיעים",
  "Member ride status": "מצב הנסיעות של חברי הקבוצה",
  "Apply an absence to several events at once.":
    "החילו היעדרות על כמה אירועים בבת אחת.",
  "Assigned family": "משפחה משובצת",
  "Attendance and ride needs": "נוכחות וצורכי הסעה",
  "Calendar view": "תצוגת לוח שנה",
  "Change failed.": "השינוי נכשל.",
  "Choose a venue": "בחרו מקום",
  Date: "תאריך",
  Delete: "מחיקה",
  "Delete this event?": "למחוק את האירוע?",
  "Drive counts": "מספר נסיעות כנהגים",
  "Driving family": "משפחה מסיעה",
  Edit: "עריכה",
  "End time": "שעת סיום",
  "Event schedule": "לוח אירועים",
  "Event type": "סוג האירוע",
  From: "מתאריך",
  "Group breaks": "הפסקות קבוצתיות",
  "Label (optional)": "תיאור (אופציונלי)",
  "Loading…": "טוענים…",
  Month: "חודש",
  "Multi-day absences": "היעדרויות למספר ימים",
  "Needs ride home": "נדרשת הסעה הביתה",
  "Needs ride there": "נדרשת הסעה לשם",
  Next: "הבא",
  "No carpool needed": "אין צורך בהסעה",
  "Group break": "הפסקה קבוצתית",
  "No rides needed": "אין צורך בנסיעות",
  "Not attending": "לא משתתפים",
  OPEN: "פנוי",
  "One count per active assigned ride.": "ספירה אחת לכל נסיעה פעילה ששובצה.",
  "One-time event": "אירוע חד-פעמי",
  "Open events and ride assignments.": "פתיחת אירועים ושיבוצי נסיעות.",
  "Optional event name": "שם אירוע (אופציונלי)",
  "Regular events are paused during a break; special events remain visible.":
    "אירועים רגילים מושהים בזמן הפסקה; אירועים מיוחדים נשארים גלויים.",
  Previous: "הקודם",
  "Release ride": "ויתור על הנסיעה",
  Remove: "הסרה",
  "Removed.": "הוסר.",
  "Ride home": "נסיעה הביתה",
  "Ride there": "נסיעה לשם",
  Riders: "נוסעים",
  Save: "שמירה",
  "Save absence": "שמירת היעדרות",
  "Saved.": "נשמר.",
  "Saving…": "שומרים…",
  "Schedule, breaks, families, and driving fairness.":
    "לוח זמנים, הפסקות, משפחות וחלוקה הוגנת של הנהיגה.",
  "Share week": "שיתוף השבוע",
  "Start time": "שעת התחלה",
  Through: "עד תאריך",
  Today: "היום",
  "Upcoming ride status": "מצב הנסיעות הקרובות",
  Venue: "מקום",
  "Venue name": "שם המקום",
  "We'll drive": "אנחנו נסיע",
  Week: "שבוע",
  Weekday: "יום בשבוע",
  "Recurring weekly events": "אירועים שבועיים קבועים",
  "Winter break": "חופשת חורף",
  "{{count}} riders": "{{count}} נוסעים",
  "{{count}} rides": "{{count}} נסיעות",
  "{{count}} rides need a driver": "{{count}} נסיעות זקוקות לנהג",
  "Regular event": "אירוע רגיל",
  "Special event": "אירוע מיוחד",
  "Trip or competition": "טיול או תחרות",
  "Event name": "שם האירוע",
  "Weekly Scouts meeting": "פעולת צופים שבועית",
  Monday: "יום שני",
  Tuesday: "יום שלישי",
  Wednesday: "יום רביעי",
  Thursday: "יום חמישי",
  Friday: "יום שישי",
  Saturday: "יום שבת",
  Sunday: "יום ראשון",
  "Import selected people": "ייבוא אנשים נבחרים",
  "Paste name and phone, one per line.": "הדביקו שם וטלפון, אחד בכל שורה.",
  "Roster rows": "שורות רשימת חברים",
  "Adding…": "מוסיפים…",
  "Add selected people": "הוספת האנשים שנבחרו",
  "Add at least one row in the format Name, Phone.":
    "הוסיפו לפחות שורה אחת בפורמט שם, טלפון.",
  "Could not update the roster.": "לא ניתן לעדכן את רשימת החברים.",
  About: "אודות",
  "Private groups. Smarter rides.": "קבוצות פרטיות. נסיעות חכמות יותר.",
  "Important notice": "הודעה חשובה",
  "Please understand the limits of this service.":
    "חשוב להכיר את מגבלות השירות.",
  "Carpool Together is a coordination tool. It is not a transportation provider, rideshare broker, employer, insurer, background-check service, or emergency service.":
    "Carpool Together הוא כלי לתיאום בלבד. הוא אינו ספק תחבורה, מתווך נסיעות, מעסיק, מבטח, שירות בדיקות רקע או שירות חירום.",
  "The service does not verify drivers, vehicles, licenses, insurance, child-restraint equipment, routes, schedules, or safety. Users and group organizers decide whether to offer or accept a ride and remain responsible for following applicable laws and confirming that each ride is appropriate.":
    "השירות אינו מאמת נהגים, כלי רכב, רישיונות, ביטוח, ציוד בטיחות לילדים, מסלולים, לוחות זמנים או בטיחות. המשתמשים ומארגני הקבוצה מחליטים אם להציע או לקבל נסיעה ואחראים לציות לחוק ולווידוא שכל נסיעה מתאימה.",
  "Route, timing, capacity, and carpool suggestions are estimates for planning only. They are not guarantees. Do not rely on the service for emergencies or time-critical transportation.":
    "הצעות למסלול, זמנים, קיבולת ושיבוץ הן הערכות לצורכי תכנון בלבד ואינן התחייבות. אין להסתמך על השירות במקרי חירום או לנסיעות קריטיות בזמן.",
  "To the fullest extent permitted by applicable law, this proof service is provided “as is” and “as available,” without warranties. Use it at your own risk. Nothing in this notice limits rights or responsibilities that cannot legally be waived.":
    "במידה המרבית המותרת בחוק, שירות זה ניתן כפי שהוא ובהתאם לזמינותו, ללא אחריות. השימוש בו הוא על אחריות המשתמש. הודעה זו אינה מגבילה זכויות או חובות שלא ניתן לוותר עליהן לפי חוק.",
  "This notice is not legal advice or a replacement for complete Terms of Service and a Privacy Policy. Obtain review from a qualified attorney before a public launch.":
    "הודעה זו אינה ייעוץ משפטי ואינה תחליף לתנאי שימוש ולמדיניות פרטיות מלאים. יש לקבל בדיקה מעורך דין מוסמך לפני השקה ציבורית.",
  "Switch group": "החלפת קבוצה",
  "Choose the group you want to manage.": "בחרו את הקבוצה שברצונכם לנהל.",
  "Your groups": "הקבוצות שלכם",
  "Current group": "הקבוצה הנוכחית",
  "Open this group": "פתיחת הקבוצה",
  "Your account belongs to {{count}} private groups.":
    "החשבון שלכם משויך ל-{{count}} קבוצות פרטיות.",
  "Group schedule": "לוח הזמנים של הקבוצה",
  "No event scheduled": "אין אירוע מתוכנן",
  "Privacy and consent": "פרטיות והסכמה",
  "Group members can view household addresses for driving and routes.":
    "חברי הקבוצה יכולים לראות כתובות משקי בית לצורך נהיגה ומסלולים.",
  "Change ride status for {{name}}": "שינוי מצב הנסיעה של {{name}}",
  "Ride status for {{name}}": "מצב הנסיעה של {{name}}",
  Close: "סגירה",
  "Not attending this event": "לא משתתף באירוע הזה",
  "Include this member in the outbound ride":
    "כללו את החבר בנסיעה לאירוע",
  "Include this member in the return ride":
    "כללו את החבר בנסיעה חזרה",
  Done: "סיום",
  "Driver: {{name}}": "נהג: {{name}}",
  "No address added": "לא נוספה כתובת",
  "Could not build route.": "לא ניתן לבנות את המסלול.",
  "Reconnect to open a route.": "התחברו מחדש כדי לפתוח מסלול.",
  "The route needs a start and destination.":
    "למסלול דרושות נקודת התחלה ויעד.",
  "Preparing route…": "מכינים מסלול…",
  "Open route": "פתיחת מסלול",
  "Change maps app": "החלפת אפליקציית מפות",
  "Choose your maps app": "בחירת אפליקציית מפות",
  "Google Maps opens every stop. Apple Maps and Waze guide one stop at a time.":
    "Google Maps פותחת את כל התחנות. Apple Maps ו-Waze מנחות לתחנה אחת בכל פעם.",
  "Return here when you are ready for the next stop. Opening a stop does not mark arrival.":
    "חזרו לכאן כשתהיו מוכנים לתחנה הבאה. פתיחת תחנה אינה מסמנת הגעה.",
  "Route stops": "תחנות המסלול",
  "Open next stop: {{name}}": "פתיחת התחנה הבאה: {{name}}",
  "Final destination opened": "היעד הסופי נפתח",
  "Starting point": "נקודת התחלה",
  "Household addresses": "כתובות משקי הבית",
  "Visible to group members for pickups and driving routes.":
    "גלוי לחברי הקבוצה לצורך איסופים ומסלולי נסיעה.",
  "Address for {{name}}": "כתובת עבור {{name}}",
  "Edit address": "עריכת כתובת",
  "Add address": "הוספת כתובת",
  "Invalid route request.": "בקשת המסלול אינה תקינה.",
  "That ride is not required.": "הנסיעה הזו אינה נדרשת.",
  "This event is inside a group break.": "האירוע חל במהלך הפסקה קבוצתית.",
  "A family must claim this ride before routing.":
    "משפחה צריכה לקחת את הנסיעה לפני יצירת מסלול.",
  "No members currently need this ride.":
    "אין כרגע חברים הזקוקים לנסיעה הזו.",
  "Driving family not found.": "המשפחה המסיעה לא נמצאה.",
  "Event venue not found.": "מקום האירוע לא נמצא.",
  "Some addresses could not be geocoded. Your maps app will determine the stop order.":
    "לא ניתן היה לאתר חלק מהכתובות. אפליקציית המפות תקבע את סדר העצירות.",
  "Add missing household and venue addresses before opening this route.":
    "הוסיפו את כתובות משקי הבית והמקום החסרות לפני פתיחת המסלול.",
  "One or more route addresses could not be located.":
    "לא ניתן לאתר כתובת אחת או יותר במסלול.",
  "About and important notice": "אודות והודעה חשובה",
  "What this service does—and does not—provide.":
    "מה השירות מספק ומה אינו מספק.",
  "Create another group": "יצירת קבוצה נוספת",
  "Add an existing group": "הוספת קבוצה קיימת",
  "Verify another group with its phone number and PIN. Your verified groups will appear in the selector.":
    "אמתו קבוצה נוספת באמצעות מספר הטלפון והקוד שלה. הקבוצות שאומתו יופיעו בבורר.",
  "Add group": "הוספת קבוצה",
  "Could not add the group.": "לא ניתן להוסיף את הקבוצה.",
  Appearance: "מראה",
  Theme: "ערכת נושא",
  "Match your device, or pick light or dark for this browser.":
    "התאמה למכשיר, או בחירה בין מראה בהיר לכהה בדפדפן הזה.",
  "Match device": "התאמה למכשיר",
  Light: "בהיר",
  Dark: "כהה",
  "Group appearance": "מראה הקבוצה",
  "Group icon": "סמל הקבוצה",
  "Shown in the app header and group switcher.":
    "מוצג בכותרת האפליקציה ובבורר הקבוצות.",
  "Add icon": "הוספת סמל",
  "Change icon": "החלפת סמל",
  "Remove icon": "הסרת סמל",
  "Add photo": "הוספת תמונה",
  "Change photo": "החלפת תמונה",
  "Remove photo": "הסרת תמונה",
  "Uploading…": "מעלים…",
  "Could not save the image.": "לא ניתן לשמור את התמונה.",
  "Could not remove the image.": "לא ניתן להסיר את התמונה.",
  "Choose an image.": "בחרו תמונה.",
  "Choose an image smaller than 5 MB.": "בחרו תמונה שגודלה קטן מ־5MB.",
  "Choose a JPEG, PNG, or WebP image.": "בחרו תמונת JPEG, PNG או WebP.",
  "Group name": "שם הקבוצה",
  "Neighborhood carpool": "קבוצת נסיעות שכונתית",
  "Shared group PIN": "קוד הקבוצה המשותף",
  "6-digit group PIN": "קוד קבוצה בן 6 ספרות",
  "Group created": "הקבוצה נוצרה",
  "Generated group PIN": "קוד הקבוצה שנוצר",
  "Save and share this PIN with group members. It will not be shown again.":
    "שמרו ושתפו את הקוד עם חברי הקבוצה. הוא לא יוצג שוב.",
  "Copy PIN": "העתקת הקוד",
  Copied: "הועתק",
  "Continue to group": "המשך לקבוצה",
  "Could not copy the PIN. Select and copy it manually.":
    "לא ניתן להעתיק את הקוד. סמנו והעתיקו אותו ידנית.",
  "A secure 6-digit group PIN will be generated automatically.":
    "קוד קבוצה מאובטח בן 6 ספרות ייווצר אוטומטית.",
  "Could not generate a group PIN.": "לא ניתן ליצור קוד לקבוצה.",
  "Could not generate a unique group PIN. Try again.":
    "לא ניתן ליצור קוד ייחודי לקבוצה. נסו שוב.",
  Access: "גישה",
  "Only group owners can reveal or regenerate this PIN.":
    "רק בעלי הקבוצה יכולים להציג או ליצור מחדש את הקוד.",
  "Could not load the group PIN.": "לא ניתן לטעון את קוד הקבוצה.",
  "Regenerate the PIN once to make it viewable.":
    "צרו את הקוד מחדש פעם אחת כדי שיהיה ניתן להצגה.",
  "Reveal PIN": "הצגת הקוד",
  "Generate a new PIN": "יצירת קוד חדש",
  "Generating…": "יוצרים…",
  "Invalidate old PIN and generate": "ביטול הקוד הישן ויצירת חדש",
  "The old PIN will stop working immediately.":
    "הקוד הישן יפסיק לעבוד מיד.",
  "4 to 12 characters": "4 עד 12 תווים",
  "Creating…": "יוצרים…",
  "Create group": "יצירת קבוצה",
  "Could not create the group.": "לא ניתן ליצור את הקבוצה.",
  "Danger zone": "אזור מסוכן",
  "Delete this group": "מחיקת הקבוצה",
  "Permanently delete this group, its roster, and all of its carpool data.":
    "מחיקה לצמיתות של הקבוצה, רשימת החברים וכל נתוני הנסיעות שלה.",
  "Delete group": "מחיקת קבוצה",
  "Type {{name}} to confirm.": "הקלידו {{name}} לאישור.",
  Cancel: "ביטול",
  "Deleting…": "מוחקים…",
  "Permanently delete group": "מחיקת הקבוצה לצמיתות",
  "Could not delete the group.": "לא ניתן למחוק את הקבוצה.",
  "Carpool Together": "Carpool Together",
  "Sign in to your groups": "כניסה לקבוצות שלכם",
  "Create your group": "יצירת הקבוצה שלכם",
  "Start a private group and invite members with their phone number.":
    "פתחו קבוצה פרטית והזמינו חברים באמצעות מספר הטלפון שלהם.",
  "Use the phone number on your group roster and the shared group PIN.":
    "השתמשו במספר הטלפון שברשימת הקבוצה ובקוד הקבוצה המשותף.",
  "Your name": "השם שלכם",
  "Alex Morgan": "ישראל ישראלי",
  "Phone number": "מספר טלפון",
  "For US numbers, enter all 10 digits. No +1 needed.":
    "למספרים אמריקאיים, הזינו את כל 10 הספרות. אין צורך ב-‎+1.",
  "Group PIN": "קוד הקבוצה",
  "Signing in…": "מתחברים…",
  "Creating group…": "יוצרים קבוצה…",
  "Register and create group": "הרשמה ויצירת קבוצה",
  "Open my groups": "פתיחת הקבוצות שלי",
  "Already belong to a group?": "כבר שייכים לקבוצה?",
  "Starting a new carpool group?": "פותחים קבוצת נסיעות חדשה?",
  "Sign in": "כניסה",
  "Register and create a group": "הרשמה ויצירת קבוצה",
  "By creating a group, you agree to handle member information responsibly. ":
    "ביצירת קבוצה אתם מתחייבים לטפל במידע החברים באחריות. ",
  "Ask a group organizer if you do not know the PIN. ":
    "פנו למארגן הקבוצה אם אינכם יודעים את הקוד. ",
  "Privacy notice": "הודעת פרטיות",
  "Could not create a device session.": "לא ניתן ליצור חיבור למכשיר.",
  "Sign-in failed.": "הכניסה נכשלה.",
  "Enter a valid phone number and group PIN.":
    "הזינו מספר טלפון וקוד קבוצה תקינים.",
  "Invalid device session.": "החיבור למכשיר אינו תקין.",
  "Phone number or group PIN is incorrect.":
    "מספר הטלפון או קוד הקבוצה שגויים.",
  "This phone and PIN match more than one group. Ask an organizer to use a different group PIN.":
    "מספר הטלפון והקוד תואמים ליותר מקבוצה אחת. בקשו ממארגן לבחור קוד אחר.",
  "Too many sign-in attempts. Try again in 15 minutes.":
    "יותר מדי ניסיונות כניסה. נסו שוב בעוד 15 דקות.",
  "Enter a valid phone number and personal code.":
    "הזינו מספר טלפון וקוד אישי תקינים.",
  "Phone number or personal code is incorrect.":
    "מספר הטלפון או הקוד האישי שגויים.",
  "This account is locked after too many attempts. Try again in 15 minutes.":
    "החשבון ננעל לאחר יותר מדי ניסיונות. נסו שוב בעוד 15 דקות.",
  "Could not sign in.": "לא ניתן להיכנס.",
  "Could not link this device to your account.":
    "לא ניתן לקשר את המכשיר לחשבון שלכם.",
  "Could not link this device to your groups.":
    "לא ניתן לקשר את המכשיר לקבוצות שלכם.",
  "Sign in again to continue.": "היכנסו שוב כדי להמשיך.",
  "Add your family details before creating a group.":
    "הוסיפו את פרטי המשפחה לפני יצירת קבוצה.",
  "Choose a new six-digit code.": "בחרו קוד חדש בן שש ספרות.",
  "Choose a six-digit code.": "בחרו קוד בן שש ספרות.",
  "That is not your current code.": "זה אינו הקוד הנוכחי שלכם.",
  "Choose a code you have not used before.":
    "בחרו קוד שלא השתמשתם בו קודם.",
  "Complete every field with valid values.": "מלאו את כל השדות בערכים תקינים.",
  "Group name must contain letters or numbers.":
    "שם הקבוצה חייב לכלול אותיות או מספרים.",
  "Too many groups were created from this network today.":
    "נוצרו היום יותר מדי קבוצות מרשת זו.",
  "This device already belongs to a group. Sign in and create another group from Settings.":
    "המכשיר הזה כבר משויך לקבוצה. היכנסו וצרו קבוצה נוספת דרך ההגדרות.",
  "Enter a group name and a PIN with 4 to 12 characters.":
    "הזינו שם קבוצה וקוד באורך 4 עד 12 תווים.",
  "Your current membership is not linked to a roster entry.":
    "החברות הנוכחית שלכם אינה מקושרת לרשומת חבר.",
  "You do not have permission for this group.": "אין לכם הרשאה לקבוצה זו.",
  "Sign-in required.": "נדרשת כניסה.",
  "Unexpected server error.": "אירעה שגיאת שרת בלתי צפויה.",
  "Absence period not found.": "תקופת ההיעדרות לא נמצאה.",
  "Add at least one valid name and phone number.":
    "הוסיפו לפחות שם ומספר טלפון תקינים אחד.",
  "Break not found.": "ההפסקה לא נמצאה.",
  "Complete every setup field with valid values.":
    "מלאו את כל שדות ההגדרה בערכים תקינים.",
  "Could not check group access.": "לא ניתן לבדוק את הגישה לקבוצה.",
  "Could not finish setting up this device.":
    "לא ניתן להשלים את הגדרת המכשיר.",
  "Could not link this device to the group.":
    "לא ניתן לקשר את המכשיר לקבוצה.",
  "Could not set up the first group.": "לא ניתן להגדיר את הקבוצה הראשונה.",
  "End time must be after start time.": "שעת הסיום חייבת להיות אחרי שעת ההתחלה.",
  "Enter a valid group name.": "הזינו שם קבוצה תקין.",
  "Event not found.": "האירוע לא נמצא.",
  "Invalid absence id.": "מזהה ההיעדרות אינו תקין.",
  "Invalid absence period.": "תקופת ההיעדרות אינה תקינה.",
  "Invalid absence update.": "עדכון ההיעדרות אינו תקין.",
  "Invalid attendance details.": "פרטי הנוכחות אינם תקינים.",
  "Invalid break dates.": "תאריכי ההפסקה אינם תקינים.",
  "Invalid break id.": "מזהה ההפסקה אינו תקין.",
  "Invalid break update.": "עדכון ההפסקה אינו תקין.",
  "Invalid event details.": "פרטי האירוע אינם תקינים.",
  "Invalid event id.": "מזהה האירוע אינו תקין.",
  "Invalid event update.": "עדכון האירוע אינו תקין.",
  "Invalid household details.": "פרטי המשפחה אינם תקינים.",
  "Invalid location details.": "פרטי המקום אינם תקינים.",
  "Invalid recurring schedule.": "לוח הזמנים החוזר אינו תקין.",
  "Invalid request body.": "פרטי הבקשה אינם תקינים.",
  "Invalid ride claim.": "שיבוץ הנסיעה אינו תקין.",
  "Invalid setup secret.": "קוד ההגדרה אינו תקין.",
  "Record not found in this group.": "הרשומה לא נמצאה בקבוצה זו.",
  "That ride leg has already been claimed.": "הנסיעה הזו כבר שובצה.",
  "That ride leg is not required.": "אין צורך בקטע הנסיעה הזה.",
  "The first group has already been set up.": "הקבוצה הראשונה כבר הוגדרה.",
  "The suggestion request is invalid.": "בקשת הצעת השיבוץ אינה תקינה.",
  "You may only manage participants in your household.":
    "ניתן לנהל רק משתתפים מהמשפחה שלכם.",
  "You may only update your own household.":
    "ניתן לעדכן רק את המשפחה שלכם.",
  "Your membership is not linked to a household.":
    "החברות שלכם אינה מקושרת למשפחה.",
  "Return to the app": "חזרה לאפליקציה",
  "Carpool Together stores information supplied by group organizers and members to coordinate private carpools. This may include names, phone numbers, group membership, pickup details, ride requests, and driver capacity.":
    "Carpool Together שומר מידע שמספקים מארגני הקבוצה וחבריה לצורך תיאום נסיעות פרטיות. המידע עשוי לכלול שמות, מספרי טלפון, שיוך לקבוצה, פרטי איסוף, בקשות נסיעה ומספר מקומות פנויים אצל נהגים.",
  "Phone numbers and group data are used for access control and carpool coordination. They are not sold or used for advertising. Access is limited by group membership and organizer permissions.":
    "מספרי טלפון ונתוני קבוצה משמשים לבקרת גישה ולתיאום נסיעות. הם אינם נמכרים ואינם משמשים לפרסום. הגישה מוגבלת לפי חברות בקבוצה והרשאות המארגנים.",
  "Group organizers are responsible for collecting information with appropriate consent, keeping rosters current, and removing people who should no longer have access. Users should provide only information needed for coordination.":
    "מארגני הקבוצה אחראים לאיסוף מידע בהסכמה מתאימה, לעדכון רשימות החברים ולהסרת מי שאינו אמור להמשיך לקבל גישה. על המשתמשים למסור רק מידע הנחוץ לתיאום.",
  "Data is stored by the application's hosting and database providers. No internet service can guarantee absolute security or availability. Contact the group organizer to request correction or deletion of group information.":
    "המידע נשמר אצל ספקי האחסון ומסד הנתונים של האפליקציה. שום שירות אינטרנט אינו יכול להבטיח אבטחה או זמינות מוחלטות. לתיקון או למחיקה של מידע קבוצתי יש לפנות למארגן הקבוצה.",
  "This initial notice must be reviewed and updated for the deployed service's operator, jurisdiction, retention practices, and contact details before a broad public launch.":
    "לפני השקה ציבורית רחבה יש לבדוק ולעדכן הודעה ראשונית זו בהתאם למפעיל השירות, לתחום השיפוט, למדיניות שמירת המידע ולפרטי הקשר.",
};

type I18nContextValue = {
  locale: Locale;
  t: (key: string, replacements?: Replacements) => string;
  toggleLocale: () => void;
};

const I18nContext = createContext<I18nContextValue | null>(null);
const LOCALE_CHANGE_EVENT = "carpool-locale-change";

function getLocaleSnapshot(): Locale {
  const saved = window.localStorage.getItem("carpool-locale");
  if (saved === "en" || saved === "he") return saved;

  return navigator.languages.some((language) => language.startsWith("he"))
    ? "he"
    : "en";
}

function subscribeToLocale(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(LOCALE_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(LOCALE_CHANGE_EVENT, onStoreChange);
  };
}

function setStoredLocale(locale: Locale) {
  window.localStorage.setItem("carpool-locale", locale);
  window.dispatchEvent(new Event(LOCALE_CHANGE_EVENT));
}

export function translate(
  locale: Locale,
  key: string,
  replacements: Replacements = {},
) {
  const template = locale === "he" ? (hebrew[key] ?? key) : key;

  return Object.entries(replacements).reduce(
    (result, [name, value]) =>
      result.replaceAll(`{{${name}}}`, String(value)),
    template,
  );
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(
    subscribeToLocale,
    getLocaleSnapshot,
    (): Locale => "en",
  );

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "he" ? "rtl" : "ltr";
  }, [locale]);

  const t = useCallback(
    (key: string, replacements?: Replacements) =>
      translate(locale, key, replacements),
    [locale],
  );
  const toggleLocale = useCallback(
    () => setStoredLocale(locale === "en" ? "he" : "en"),
    [locale],
  );

  return (
    <I18nContext.Provider
      value={{
        locale,
        t,
        toggleLocale,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function LanguagePicker() {
  const { locale, toggleLocale } = useI18n();
  return <button className="secondary-button language-picker" type="button" onClick={toggleLocale} aria-label={locale === "en" ? "Switch to Hebrew" : "מעבר לאנגלית"}>
    {locale === "en" ? "English · עברית" : "עברית · English"}
  </button>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within LanguageProvider.");
  }
  return context;
}
