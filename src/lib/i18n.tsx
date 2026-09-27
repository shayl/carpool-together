"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useSyncExternalStore,
} from "react";

type Locale = "en" | "he";
type Replacements = Record<string, string | number>;

export const hebrew: Record<string, string> = {
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
  Family: "משפחה",
  "No rider yet": "עדיין אין נוסע",
  "Thursday practice": "אימון ביום חמישי",
  "Homeward ride requested": "התבקשה נסיעה הביתה",
  "The people who keep everyone moving.": "האנשים שעוזרים לכולם להגיע.",
  "Group roster": "רשימת חברי הקבוצה",
  "{{count}} people": "{{count}} אנשים",
  "Phone hidden": "מספר הטלפון מוסתר",
  owner: "בעלים",
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
  Address: "כתובת",
  "All rides covered": "לכל הנסיעות יש נהג",
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
  "Addresses stay private to authorized rides.":
    "הכתובות נשארות פרטיות ומוצגות רק לנסיעות מורשות.",
  "About and important notice": "אודות והודעה חשובה",
  "What this service does—and does not—provide.":
    "מה השירות מספק ומה אינו מספק.",
  "Create another group": "יצירת קבוצה נוספת",
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

  const toggleLocale = () =>
    setStoredLocale(locale === "en" ? "he" : "en");

  return (
    <I18nContext.Provider
      value={{
        locale,
        t: (key, replacements) => translate(locale, key, replacements),
        toggleLocale,
      }}
    >
      <button
        className="language-switch"
        type="button"
        onClick={toggleLocale}
        aria-label={locale === "en" ? "Switch to Hebrew" : "מעבר לאנגלית"}
      >
        {locale === "en" ? "עברית" : "English"}
      </button>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within LanguageProvider.");
  }
  return context;
}
