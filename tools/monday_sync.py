# PROWORLD · the monday side of the daily roster sync.
# Runs INSIDE monday's own code sandbox: execute_code(language "python", return_outputs true, timeout_sec 280,
# code = this whole file unchanged, vars = the object `pwroster.py prepare` prints). It never sees a password.
#   1. applies what the portal queued, only if ACTIONS_B64 matches ACTIONS_SHA (a damaged copy changes nothing on monday):
#      coach-added player -> LEADS "New Requests" with the flag; status (away / finished / active) -> General Attendance
#   2. exports the General Attendance board and the LEADS items the portal waits on -> /outputs/monday.json
import base64, hashlib, json, os, re, time, requests
VERSION = 'pw-monday-sync/1'
GA, LEADS = 6929280872, 2088324589
FULL = {'development_boys___weekly': 'active', 'new_group88171': 'new', 'group_mm39q2ds': 'notOnAccounting', 'group_mks7jtwb': 'tryouts'}
THIN = {'new_group8431': 'away', 'new_group': 'finished'}
C_FULL = ['text', 'color_mm3mzpq1', 'enrollment', 'status152', 'color_mkqayh29', 'group0', 'status70', 'date_mkswwmxr',
          'color_mkswq54a', 'date_mm1z1npj', 'parent_contact', 'customer_email', 'phone2', 'date9']
C_THIN = ['text', 'color_mm3mzpq1', 'enrollment', 'group0']
ID = re.compile(r'^[0-9]{1,20}$')
REF = re.compile(r'^[A-Za-z0-9_-]{1,64}$')


def gql(q, v=None):
    for i in range(5):
        r = requests.post('https://api.monday.com/v2', json={'query': q, 'variables': v or {}}, timeout=90)
        try:
            body = r.json()
        except ValueError:
            body = {'errors': [{'message': 'HTTP %s' % r.status_code}]}
        err = body.get('errors') or body.get('error_message') or body.get('error_code')
        if not err:
            return body['data']
        s = json.dumps(err)
        if i < 4 and re.search(r'complexity|rate.?limit|try again|timeout|HTTP 5', s, re.I):
            time.sleep(10 * (i + 1))
            continue
        raise RuntimeError(s[:600])


def note(item_id, text):
    gql('mutation($i:ID!,$t:String!){ create_update(item_id:$i, body:$t){ id } }', {'i': str(item_id), 't': text})


def add_lead(a):
    tag = '[pw:%s]' % a['ref']
    found = gql('query{ boards(ids:[%d]){ items_page(limit:5, query_params:{rules:[{column_id:"long_text", compare_value:["%s"], '
                'operator:contains_text}]}){ items{ id } } } }' % (LEADS, tag))['boards'][0]['items_page']['items']
    if found:                                  # already sent by an earlier run that did not finish: never make a second one
        return {'itemId': found[0]['id'], 'existing': True}
    cv = {'text': a.get('last', ''), 'long_text': {'text': a['note'] + ' ' + tag}}
    extra = {'status_176': {'label': 'Coach'}}
    if a.get('playerGroup'):
        extra['status_126'] = {'label': a['playerGroup']}
    if a.get('program'):
        extra['status_12'] = {'label': a['program']}
    m = 'mutation($b:ID!,$g:String!,$n:String!,$v:JSON!){ create_item(board_id:$b, group_id:$g, item_name:$n, column_values:$v){ id } }'
    try:
        iid = gql(m, {'b': str(LEADS), 'g': 'topics', 'n': a['first'][:255], 'v': json.dumps(dict(cv, **extra))})['create_item']['id']
    except RuntimeError:                       # a label was renamed on the board: keep the name, last name and the flag
        iid = gql(m, {'b': str(LEADS), 'g': 'topics', 'n': a['first'][:255], 'v': json.dumps(cv)})['create_item']['id']
    note(iid, a['update'])
    return {'itemId': iid, 'existing': False}


def set_status(a):
    if not ID.match(str(a.get('itemId', ''))) or a.get('label') not in ('AWAY', 'ACTIVE', 'FINISHED'):
        raise RuntimeError('bad status action')
    it = gql('query($i:[ID!]){ items(ids:$i){ id state board{ id } column_values(ids:["color_mm3mzpq1"]){ text } } }', {'i': [str(a['itemId'])]})['items']
    if not it or str(it[0]['board']['id']) != str(GA) or it[0]['state'] != 'active':
        raise RuntimeError('this player is not on the General Attendance board any more')
    if (it[0]['column_values'][0]['text'] or '').upper() == a['label']:
        return {'changed': False}
    gql('mutation($b:ID!,$i:ID!,$v:JSON!){ change_multiple_column_values(board_id:$b, item_id:$i, column_values:$v){ id } }',
        {'b': str(GA), 'i': str(a['itemId']), 'v': json.dumps({'color_mm3mzpq1': {'label': a['label']}})})
    note(a['itemId'], a['update'])
    return {'changed': True}


raw = base64.b64decode(os.environ.get('ACTIONS_B64', '') or b'W10=').decode('utf-8')
sha = hashlib.sha256(raw.encode('utf-8')).hexdigest()
accepted = sha == os.environ.get('ACTIONS_SHA', hashlib.sha256(b'[]').hexdigest())
applied = []
for a in (json.loads(raw) if accepted else []):
    res = {'ref': a.get('ref'), 'type': a.get('type')}
    try:
        if not REF.match(str(a.get('ref', ''))):
            raise RuntimeError('bad reference')
        res.update(add_lead(a) if a.get('type') == 'add' else set_status(a), ok=True)
    except Exception as e:                     # one bad action never stops the rest or the export
        res.update(ok=False, error=str(e)[:300])
    applied.append(res)


def group_items(gid, cols):
    q1 = ('query($b:[ID!],$g:[String],$c:[String!]){ boards(ids:$b){ groups(ids:$g){ items_page(limit:500){ cursor items{ id name updated_at '
          'column_values(ids:$c){ id text } } } } } }')
    q2 = 'query($k:String!,$c:[String!]){ next_items_page(limit:500, cursor:$k){ cursor items{ id name updated_at column_values(ids:$c){ id text } } } }'
    gs = gql(q1, {'b': [str(GA)], 'g': [gid], 'c': cols})['boards'][0]['groups']
    if not gs:
        raise RuntimeError('group %s is gone from the General Attendance board: update FULL / THIN in tools/monday_sync.py' % gid)
    page = gs[0]['items_page']
    out = list(page['items'])
    while page.get('cursor'):
        page = gql(q2, {'k': page['cursor'], 'c': cols})['next_items_page']
        out.extend(page['items'])
    return out


items, counts = [], {}
for gid, key in list(FULL.items()) + list(THIN.items()):
    rows = group_items(gid, C_FULL if gid in FULL else C_THIN)
    counts[key] = len(rows)
    for it in rows:
        c = {x['id']: x['text'] for x in it['column_values'] if x['text'] not in (None, '')}
        items.append({'id': it['id'], 'g': key, 'name': it['name'], 'u': it['updated_at'], 'c': c})

watch = [x for x in os.environ.get('LEADS_WATCH', '').split(',') if ID.match(x.strip())]
leads = []
for i in range(0, len(watch), 50):
    for it in gql('query($i:[ID!]){ items(ids:$i){ id name state board{ id } group{ id title } column_values(ids:["status"]){ text } } }',
                  {'i': watch[i:i + 50]})['items']:
        leads.append({'id': it['id'], 'state': it['state'], 'board': it['board']['id'], 'group': it['group']['title'] if it['group'] else '',
                      'stage': it['column_values'][0]['text'] if it['column_values'] else ''})

doc = {'schema': VERSION, 'at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'actionsSha': sha, 'actionsAccepted': accepted,
       'applied': applied, 'counts': counts, 'items': items, 'leads': leads}
data = json.dumps(doc, separators=(',', ':'), ensure_ascii=False)
os.makedirs('/outputs', exist_ok=True)
with open('/outputs/monday.json', 'w', encoding='utf-8') as f:
    f.write(data)
print(json.dumps({'ok': True, 'schema': VERSION, 'sha256': hashlib.sha256(data.encode('utf-8')).hexdigest(), 'bytes': len(data.encode('utf-8')),
                  'counts': counts, 'actionsAccepted': accepted, 'applied': [[a['type'], a.get('ok')] for a in applied], 'leads': len(leads)}))
print('PW-MONDAY-EXPORT ' + data)              # the whole export, one line: the run saves this tool result as a file and hands it to pwroster.py
