from flask import Flask, jsonify, request
from icalendar import Calendar, Event
from datetime import datetime, timedelta, time
import os
from flask import Flask, jsonify, request
from flask_cors import CORS


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))  # Render stellt $PORT bereit
    app.run(host="0.0.0.0", port=port)


app = Flask(__name__)
CORS(app)  # Aktiviert CORS für alle Routen


ICAL_FILE = "calendar.ics"

def read_calendar():
    if not os.path.exists(ICAL_FILE):
        cal = Calendar()
        cal.add('version', '2.0')
        cal.add('prodid', '-//Example Inc.//Example Calendar//EN')
        with open(ICAL_FILE, 'wb') as f:
            f.write(cal.to_ical())
    with open(ICAL_FILE, 'rb') as f:
        cal = Calendar.from_ical(f.read())
        print("Geladene Termine aus iCal-Datei:")
        for component in cal.walk('VEVENT'):
            print(f"- {component.decoded('DTSTART')} bis {component.decoded('DTEND')}")
        return cal


# Helper: Write to iCal file
def write_calendar(calendar):
    with open(ICAL_FILE, 'wb') as f:
        f.write(calendar.to_ical())

def generate_available_slots():
    now = datetime.now(timezone.utc)  # Alle Zeiten in UTC
    end_date = now + timedelta(weeks=52)

    slots = []
    current_date = now

    while current_date <= end_date:
        weekday = current_date.weekday()
        if weekday in [0, 1, 2, 3]:  # Monday to Thursday
            start_hour, end_hour = 8, 14
        elif weekday == 4:  # Friday
            start_hour, end_hour = 8, 11
        else:  # Skip Saturday and Sunday
            current_date += timedelta(days=1)
            continue

        # Generate hourly slots
        for hour in range(start_hour, end_hour):
            start_time = datetime(
                current_date.year, current_date.month, current_date.day, hour, 0, tzinfo=timezone.utc
            )
            end_time = start_time + timedelta(hours=1)
            print(f"Generierter Slot: {start_time} bis {end_time}")  # Debugging
            slots.append({"start": start_time, "end": end_time})

        current_date += timedelta(days=1)

    return slots



from datetime import datetime, timezone

def is_slot_free(cal, start_time, end_time):
    # Zeitzonen sicherstellen
    if start_time.tzinfo is None:
        start_time = start_time.replace(tzinfo=timezone.utc)
    if end_time.tzinfo is None:
        end_time = end_time.replace(tzinfo=timezone.utc)

    print(f"Prüfe Slot von {start_time} bis {end_time}")

    for component in cal.walk('VEVENT'):
        event_start = component.decoded('DTSTART')
        event_end = component.decoded('DTEND')

        if event_start.tzinfo is None:
            event_start = event_start.replace(tzinfo=timezone.utc)
        if event_end.tzinfo is None:
            event_end = event_end.replace(tzinfo=timezone.utc)

        print(f"Vergleiche mit gebuchtem Termin von {event_start} bis {event_end}")

        # Überlappung prüfen
        if start_time < event_end and end_time > event_start:
            print("Slot ist belegt")
            return False  # Belegt

    print("Slot ist frei")
    return True  # Frei




@app.route('/available', methods=['GET'])
def get_available_slots():
    cal = read_calendar()
    available_slots = generate_available_slots()

    print("Alle generierten Slots:")
    for slot in available_slots:
        print(f"{slot['start']} bis {slot['end']}")

    # Nur freie Slots filtern
    free_slots = []
    for slot in available_slots:
        if is_slot_free(cal, slot["start"], slot["end"]):
            free_slots.append(slot)
        else:
            print(f"Belegter Slot ausgeschlossen: {slot['start']} bis {slot['end']}")

    print("Freie Slots nach Filterung:")
    for slot in free_slots:
        print(f"Frei: {slot['start']} bis {slot['end']}")

    # Antwortstruktur
    response = {}
    for slot in free_slots:
        start = slot["start"].isoformat()[:19]
        response[start] = True

    print("API-Antwort:")
    print(response)
    return jsonify(response)




# API: Book a slot
@app.route('/book', methods=['POST'])
def book_slot():
    data = request.json
    start_time = datetime.fromisoformat(data['start'])
    end_time = datetime.fromisoformat(data['end'])

    cal = read_calendar()

    # Check if the slot is free
    if not is_slot_free(cal, start_time, end_time):
        return jsonify({"error": "Slot already booked"}), 400

    # Add new event
    event = Event()
    event.add('uid', f"{start_time.timestamp()}@example.com")
    event.add('dtstamp', datetime.now())
    event.add('dtstart', start_time)
    event.add('dtend', end_time)
    event.add('summary', 'Booked via API')
    cal.add_component(event)

    # Write back to file
    write_calendar(cal)

    return jsonify({"message": "Booking successful"})

if __name__ == '__main__':
    app.run(debug=True)
