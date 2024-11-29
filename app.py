from flask import Flask, jsonify, request, render_template, abort
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta, timezone
import os
import logging
from flasgger import Swagger

# Initialisiere Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///calendar.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)
swagger = Swagger(app)

class Event(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    start_time = db.Column(db.DateTime(timezone=True), nullable=False)
    end_time = db.Column(db.DateTime(timezone=True), nullable=False)
    summary = db.Column(db.String(120))

    def __repr__(self):
        return f'<Event {self.id} {self.start_time} - {self.end_time}>'

with app.app_context():
    db.create_all()

def generate_available_slots(start_date=None, end_date=None):
    if not start_date:
        start_date = datetime.now(timezone.utc)
    if not end_date:
        end_date = start_date + timedelta(weeks=4)
    slots = []
    current_date = start_date

    while current_date <= end_date:
        weekday = current_date.weekday()
        if weekday in [0, 1, 2, 3]:  # Montag bis Donnerstag
            start_hour, end_hour = 8, 14
        elif weekday == 4:  # Freitag
            start_hour, end_hour = 8, 11
        else:
            current_date += timedelta(days=1)
            continue

        for hour in range(start_hour, end_hour):
            start_time = datetime(
                current_date.year, current_date.month, current_date.day, hour, 0, tzinfo=timezone.utc
            )
            end_time = start_time + timedelta(hours=1)
            logger.info(f"Generierter Slot: {start_time} bis {end_time}")
            slots.append({"start": start_time, "end": end_time})

        current_date += timedelta(days=1)

    return slots

def is_slot_free(start_time, end_time):
    overlapping_events = Event.query.filter(
        Event.start_time < end_time,
        Event.end_time > start_time
    ).all()
    if overlapping_events:
        logger.info(f"Slot von {start_time} bis {end_time} ist belegt.")
        return False
    else:
        logger.info(f"Slot von {start_time} bis {end_time} ist frei.")
        return True

@app.route('/')
def index():
    return render_template('index.html')

def format_date_for_key(date):
    return date.strftime('%Y-%m-%dT%H:%M:%S')

@app.route('/available', methods=['GET'])
def get_available_slots():
    start_date_str = request.args.get('start_date')
    end_date_str = request.args.get('end_date')
    if not start_date_str or not end_date_str:
        start_date = datetime.now(timezone.utc)
        end_date = start_date + timedelta(weeks=4)
    else:
        try:
            start_date = datetime.fromisoformat(start_date_str)
            if start_date.tzinfo is None:
                start_date = start_date.replace(tzinfo=timezone.utc)
            end_date = datetime.fromisoformat(end_date_str)
            if end_date.tzinfo is None:
                end_date = end_date.replace(tzinfo=timezone.utc)
        except ValueError:
            return jsonify({"error": "Invalid date format"}), 400

    available_slots = generate_available_slots(start_date, end_date)
    free_slots = []
    for slot in available_slots:
        if is_slot_free(slot["start"], slot["end"]):
            free_slots.append(slot)
        else:
            logger.info(f"Belegter Slot ausgeschlossen: {slot['start']} bis {slot['end']}")

    response = {}
    for slot in free_slots:
        start = format_date_for_key(slot["start"])
        response[start] = True

    logger.info("API-Antwort:")
    logger.info(response)
    return jsonify(response)

@app.route('/book', methods=['POST'])
def book_slot():
    data = request.get_json()
    if not data or 'start' not in data or 'end' not in data:
        return jsonify({"error": "Ungültige Eingabedaten"}), 400

    try:
        start_time = datetime.strptime(data['start'], '%Y-%m-%dT%H:%M:%S').replace(tzinfo=timezone.utc)
        end_time = datetime.strptime(data['end'], '%Y-%m-%dT%H:%M:%S').replace(tzinfo=timezone.utc)
    except ValueError as e:
        return jsonify({"error": "Ungültiges Datumsformat"}), 400

    if not is_slot_free(start_time, end_time):
        return jsonify({"error": "Der gewählte Slot ist bereits gebucht."}), 400

    event = Event(
        start_time=start_time,
        end_time=end_time,
        summary='Gebucht über die API'
    )
    try:
        db.session.add(event)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"Fehler beim Buchen des Slots: {e}")
        return jsonify({"error": "Fehler beim Buchen des Slots"}), 500

    return jsonify({"message": "Buchung erfolgreich"})
    
if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5050))
    app.run(host="0.0.0.0", port=port, debug=True)
