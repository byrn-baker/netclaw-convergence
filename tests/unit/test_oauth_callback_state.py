import importlib.util
from pathlib import Path
import threading
import urllib.request
import urllib.error
from http.server import HTTPServer
import pytest

ROOT=Path(__file__).resolve().parents[2]


def module(monkeypatch,tmp_path):
    monkeypatch.setenv('HOME',str(tmp_path))
    spec=importlib.util.spec_from_file_location('oauth_fixture',ROOT/'scripts/twitter_oauth2_setup.py')
    obj=importlib.util.module_from_spec(spec);spec.loader.exec_module(obj)
    return obj


@pytest.mark.parametrize('path',['/callback?code=wrong','/callback?code=wrong&state=other','/unrelated?code=wrong&state=expected','/callback?code=wrong&state=expected&state=other'])
def test_callback_rejects_unbound_codes(monkeypatch,tmp_path,path):
    obj=module(monkeypatch,tmp_path);obj.CallbackHandler.expected_state='expected';obj.CallbackHandler.code=None
    with HTTPServer(('127.0.0.1',0),obj.CallbackHandler) as server:
        thread=threading.Thread(target=server.handle_request);thread.start()
        try:
            urllib.request.urlopen('http://127.0.0.1:'+str(server.server_port)+path,timeout=3)
        except urllib.error.HTTPError as error:
            assert error.code==400
        thread.join(3)
    assert obj.CallbackHandler.code is None


def test_callback_accepts_matching_state(monkeypatch,tmp_path):
    obj=module(monkeypatch,tmp_path);obj.CallbackHandler.expected_state='expected';obj.CallbackHandler.code=None
    with HTTPServer(('127.0.0.1',0),obj.CallbackHandler) as server:
        thread=threading.Thread(target=server.handle_request);thread.start()
        with urllib.request.urlopen('http://127.0.0.1:'+str(server.server_port)+'/callback?code=good&state=expected',timeout=3) as response:
            assert response.status==200
        thread.join(3)
    assert obj.CallbackHandler.code=='good'


def test_tokens_saved_privately_and_failed_validation_preserves_original(monkeypatch,tmp_path,capsys):
    obj=module(monkeypatch,tmp_path);path=tmp_path/'.env';path.write_text('UNRELATED=keep\n')
    obj.save_tokens(path,'access "quote" dollar$','refresh & pipe|')
    spec=importlib.util.spec_from_file_location('writer',ROOT/'scripts/write-env.py');writer=importlib.util.module_from_spec(spec);spec.loader.exec_module(writer)
    assert writer.values(path.read_text())=={'UNRELATED':'keep','TWITTER_OAUTH2_ACCESS_TOKEN':'access "quote" dollar$','TWITTER_OAUTH2_REFRESH_TOKEN':'refresh & pipe|'}
    assert path.stat().st_mode&0o777==0o600
    assert capsys.readouterr().out==''
    original=path.read_bytes()
    with pytest.raises(ValueError):obj.save_tokens(path,'new-access','bad\nrefresh')
    assert path.read_bytes()==original
    link=tmp_path/'linked';link.symlink_to(path)
    with pytest.raises(ValueError):obj.save_tokens(link,'new-access','new-refresh')
    assert path.read_bytes()==original
