# backend/minima_wallet.py
from flask import Flask, request, jsonify
import requests, json, os
from decimal import Decimal

app = Flask(__name__)

# === Minima node API and your token ===
MDS_API = "http://127.0.0.1:9005"
TOKEN_ID = "0xFA65DA403978B1E4B8A23FEA63BE27793660C1362000FF4042814C12911B1CCC"

# === Simple local store for address labels ===
LABELS_FILE = os.path.join(os.path.dirname(__file__), "address_labels.json")

def load_labels():
    if os.path.exists(LABELS_FILE):
        with open(LABELS_FILE, "r") as f:
            return json.load(f)
    return {}

def save_labels(labels):
    with open(LABELS_FILE, "w") as f:
        json.dump(labels, f, indent=2)

def run_command(cmd):
    try:
        r = requests.post(f"{MDS_API}/command", json={"command": cmd}, timeout=15)
        return r.json()
    except Exception as e:
        return {"status": False, "error": str(e)}

# ========== EXISTING ==========
@app.route("/balance", methods=["GET"])
def get_wallet_token_balance():
    """Whole wallet balance for the token (all addresses combined)."""
    res = run_command("balance")
    balances = res.get("response", [])
    for b in balances:
        if b.get("tokenid", "").lower() == TOKEN_ID.lower():
            return jsonify(b)
    return jsonify({"error": "Token not found in wallet"}), 404

@app.route("/send", methods=["POST"])
def send_token():
    data = request.json or {}
    address = data.get("address")
    amount = data.get("amount")
    if not address or not amount:
        return jsonify({"error": "address and amount are required"}), 400
    cmd = f"send amount:{amount} address:{address} tokenid:{TOKEN_ID}"
    res = run_command(cmd)
    return jsonify(res)

@app.route("/history", methods=["GET"])
def history():
    res = run_command(f"txpowsearch {TOKEN_ID}")
    return jsonify(res)

# ========== NEW: ADDRESS MANAGEMENT ==========

@app.route("/addresses", methods=["GET"])
def list_addresses():
    """
    List wallet keys/addresses from Minima, merged with local labels.
    """
    labels = load_labels()
    res = run_command("keys")
    keys = res.get("response", [])
    out = []
    for k in keys:
        addr = k.get("address")
        out.append({
            "address": addr,
            "publickey": k.get("publickey"),
            "simple": k.get("simple"),
            "default": k.get("default"),
            "label": labels.get(addr)
        })
    return jsonify(out)

@app.route("/addresses", methods=["POST"])
def create_address():
    """
    Create a new receive address. Optionally attach a label.
    """
    data = request.json or {}
    label = data.get("label")
    # Minima command to derive a new address:
    res = run_command("newaddress")
    if not res.get("response"):
        return jsonify({"error": "Failed to create address", "details": res}), 500

    address = res["response"].get("address")
    if not address:
        return jsonify({"error": "No address returned", "details": res}), 500

    labels = load_labels()
    if label:
        labels[address] = label
        save_labels(labels)

    return jsonify({"address": address, "label": label})

@app.route("/balance/<address>", methods=["GET"])
def address_token_balance(address):
    """
    Sum UTXOs (coins) for a specific address and TOKEN_ID.
    """
    # coins command supports filters; we filter by tokenid and address
    res = run_command(f"coins tokenid:{TOKEN_ID} address:{address}")
    coins = res.get("response", [])
    total = Decimal("0")
    for c in coins:
        try:
            total += Decimal(str(c.get("amount", "0")))
        except Exception:
            pass

    return jsonify({
        "address": address,
        "tokenid": TOKEN_ID,
        "balance": str(total),
        "utxos": coins
    })

@app.route("/label", methods=["POST"])
def set_label():
    """
    Set/overwrite a label for an existing address.
    Body: { "address": "...", "label": "My Savings" }
    """
    data = request.json or {}
    address = data.get("address")
    label = data.get("label")
    if not address or label is None:
        return jsonify({"error": "address and label are required"}), 400

    # Optionally validate the address belongs to this wallet
    keys_res = run_command("keys")
    wallet_addrs = {k.get("address") for k in keys_res.get("response", [])}
    if address not in wallet_addrs:
        return jsonify({"error": "Address not found in this wallet"}), 404

    labels = load_labels()
    labels[address] = label
    save_labels(labels)
    return jsonify({"address": address, "label": label})
