import pytest

from services.autostart import Autostart, AutostartUnsupported, gui_python, launch_command


class FakeRegistry:
    def __init__(self):
        self.values = {}

    def get(self, name):
        return self.values.get(name)

    def set(self, name, value):
        self.values[name] = value

    def delete(self, name):
        self.values.pop(name, None)


def test_enable_disable_with_registry(tmp_path):
    reg = FakeRegistry()
    main = tmp_path / "Clip Monitor" / "main.py"
    a = Autostart(main, backend=reg, python=str(tmp_path / "python"))
    assert a.supported and not a.is_enabled()
    a.enable()
    cmd = reg.values["ClipMonitor"]
    assert cmd.endswith('main.py" --minimized') and f'"{main.resolve()}"' in cmd  # aspas: espaços no caminho
    assert a.is_enabled() and a.is_current()
    assert Autostart(tmp_path / "outra" / "main.py", backend=reg).is_current() is False
    a.set(False)
    assert not a.is_enabled() and reg.values == {}
    a.disable()  # idempotente


def test_pythonw_is_preferred(tmp_path):
    (tmp_path / "python.exe").write_text("")
    (tmp_path / "pythonw.exe").write_text("")
    assert gui_python(str(tmp_path / "python.exe")).endswith("pythonw.exe")
    assert gui_python(str(tmp_path / "other")).endswith("other")
    assert "pythonw.exe" in launch_command(tmp_path / "main.py", str(tmp_path / "python.exe"))


def test_unsupported_platform(monkeypatch, tmp_path):
    import sys

    monkeypatch.setattr(sys, "platform", "linux")
    a = Autostart(tmp_path / "main.py")
    assert not a.supported and not a.is_enabled()
    with pytest.raises(AutostartUnsupported):
        a.enable()
