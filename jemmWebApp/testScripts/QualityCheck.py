import csv
import hashlib
import logging
import re
import requests
import io
import warnings
import sys
import pandas as pd

# from baseline.encrypt import *
# from encrypt import *

# This is a script to run manual quality checks on the data we have uploaded

check = [1,1,1,1]
# Check 1: First item in check list, set to 1 if you want to use this. Checks
# all of the items in the key table to the items in the OTLFB to ensure that
# every item in the key table has a baseline in the OTLFB, because only items
# that have completed OTLFBs can be in the key table
# Check 2: Second item in the check list, set to 1 if you want to use this.
# Checks to see if UpdateKeyTable script is working correctly, if there are
# any items here, that means the were filtered out by UpdateKeyTable
# Check 3: Third item in the check list, set to 1 if you want to use this.
# Finds items in the OTLFB with missing infromation, mainly missing SUBID and
# Cohort numbersself.
# Check 4: Fouth item in the check list, set to 1 if you want to use this. To
# decrypt any encrypted data that needs to be changed in the OTLFB



k = "9678365400123890"

tokens = {
    "OTLFB": 'D6CB904DC7E301BC1110F4FB14D2167A',
    "OASIS": '382DDD83CE7AB6D040644E67F18D5D32',
    "PRISM": 'D6159F1AAD50ED5338AC461C5B9E9B93',
    "CHROME": '491C7B74F7F2DF4144B42F0BBE83A1BD',
}
cohort_nums = {
    'ACED':'1',
    'AIM':'2',
    'CHROME':'3',
    'COSMIC':'4',
    'FORCE':'5',
    'OASIS':'6',
    'PRISM':'7',
    'Validation Study':'8'
}

def get_cohort_key_table():
    r = requests.post('https://redcap.ucdenver.edu/api/', data={
        'token': '01F6B5DE6978B949EBBDCBA17B08F364',
        'content': 'record',
        'format': 'json',
        'type': 'flat',
        'rawOrLabel': 'raw',
        'rawOrLabelHeaders': 'raw',
        'exportCheckboxLabel': 'false',
        'exportSurveyFields': 'false',
        'exportDataAccessGroups': 'false',
        'returnFormat': 'json'
    })
    data = r.json()
    fives = {} # this is a dict to make it easier to search
    for d in data:
        fives[d['record_id']] = d['participant_id']
    return fives, data

def get_otlfb_data():
    try:
        r = requests.post('https://redcap.ucdenver.edu/api/', data={
            'token': '388F8BDB6AEEB452982B10BD9A6D8C88',
            'content': 'report',
            'format': 'json',
            'report_id': '31864',
            'rawOrLabel': 'raw',
            'rawOrLabelHeaders': 'raw',
            'exportCheckboxLabel': 'false',
            'returnFormat': 'json'
        })
        data = r.json()
    except:
        data = {}
    uniFives = []
    for d in data:
        if d['five_digit'] not in uniFives:
            uniFives.append(d['five_digit'])
    return uniFives, data

def get_basline_data(token):
    # when more studies get added be sure to add the correct report number
    report_num = {
        '382DDD83CE7AB6D040644E67F18D5D32': '27709',
        'D6159F1AAD50ED5338AC461C5B9E9B93': '27713',
        '491C7B74F7F2DF4144B42F0BBE83A1BD': '29399',
    }
    try:
        r = requests.post('https://redcap.ucdenver.edu/api/', data={
            'token': token,
            'content': 'report',
            'format': 'json',
            'report_id': report_num[token],
            'rawOrLabel': 'raw',
            'rawOrLabelHeaders': 'raw',
            'exportCheckboxLabel': 'false',
            'returnFormat': 'json'
        })
        data = r.json()
    except:
        data = {}
    return data

def qualityCheck(check):
    keys, key_data = get_cohort_key_table()
    otlfbs, otlfb_data = get_otlfb_data()
    missingFromKeyTable = {}

    testData = ['24908','98650','93005','1234','71415','43244']
    missType = ['06059','06413','77907']

    if check[0]:
        # print('\nMissing an OTLFB, but baseline complete\n')
        try:
            for key in keys:
                if key not in otlfbs and key not in missType and key not in testData:
                    missingFromKeyTable[key] = keys[key]
                    # print(keys[key], key)
        except:
            print('\nFailed Check 1\n')

    if check[1]:
        # print('\nBaseline complete but not in key table\n')
        try:
            for study in ['OASIS', 'PRISM', 'CHROME']:
                baselines = get_basline_data(tokens[study])
                for ptp in baselines:
                    if ptp['fivedigit'] not in keys:
                        pass
                        # print(study,ptp)
        except:
            print('\nFailed Check 2\n')

    if check[2]:
        # print('\nIn Cohort Key Table, but no cohort assigned in OTLFB\n')
        try:
            for ptp in otlfb_data:
                if ptp['five_digit'] in keys and ptp['cohort'] == '-1':
                    pass
                    # print(ptp, keys[ptp['five_digit']])
        except:
            print('\nFailed Check 3\n')

    if check[3]:
        print('\nIn OTLFB, but not in key table\n')
        try:
            for ptp in otlfb_data:
                if ptp['five_digit'] not in keys and len(ptp['five_digit']) == 8:
                    pass
                    print(ptp)
                    print(decrip(k,ptp['five_digit']))
        except:
            print('\nFailed Check 4\n')

qualityCheck(check)