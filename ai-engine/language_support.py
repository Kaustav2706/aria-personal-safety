# Dictionary containing keywords indicating distress signals in multiple languages

DISTRESS_DICTIONARY = {
    "english": [
        "help",
        "stop",
        "leave me alone",
        "please don't",
        "police",
        "run",
        "no no no"
    ],
    "hindi": [
        "bachao",
        "madad",
        "ruk jao",
        "mat maro",
        "chodo mujhe",
        "police ko bulao",
        "bachao mujhe"
    ]
}

def scan_text_for_distress(text: str) -> bool:
    """
    Scans a given text string for the presence of any distress keywords.
    """
    if not text:
        return False
        
    text_lower = text.lower()
    
    # Check English triggers
    for word in DISTRESS_DICTIONARY["english"]:
        if word in text_lower:
            return True
            
    # Check Hindi triggers
    for word in DISTRESS_DICTIONARY["hindi"]:
        if word in text_lower:
            return True
            
    return False
