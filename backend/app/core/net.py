"""局域网地址工具：获取教师端主机在局域网内可被学生端访问的 IP。"""

import socket


def _is_private_ipv4(ip: str) -> bool:
    """粗略判断是否为常见局域网私网地址（10/8、172.16-31/12、192.168/16）。"""
    if ip.startswith("10.") or ip.startswith("192.168."):
        return True
    if ip.startswith("172."):
        try:
            return 16 <= int(ip.split(".")[1]) <= 31
        except (IndexError, ValueError):
            return False
    return False


def get_lan_ip() -> str | None:
    """获取本机局域网 IPv4 地址；获取失败时返回 None。

    优先使用“UDP 连接探测”（不会真正发包），让系统选择默认路由出口 IP；
    不可用时回退到主机名/网卡地址枚举，并优先返回私网地址。
    """
    # 方法一：连接一个外部地址的假 UDP socket，仅用于获取本机出口 IP
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("8.8.8.8", 80))
            ip = sock.getsockname()[0]
            if ip and not ip.startswith("127."):
                return ip
    except OSError:
        pass

    # 方法二：主机名解析出的全部 IPv4 地址
    candidates: list[str] = []
    try:
        candidates = socket.gethostbyname_ex(socket.gethostname())[2]
    except OSError:
        pass
    if not candidates:
        try:
            candidates = [
                addr[4][0]
                for addr in socket.getaddrinfo(
                    socket.gethostname(), None, socket.AF_INET
                )
                if addr[4][0] and not addr[4][0].startswith("127.")
            ]
        except OSError:
            candidates = []

    for ip in candidates:
        if _is_private_ipv4(ip):
            return ip
    return candidates[0] if candidates else None
