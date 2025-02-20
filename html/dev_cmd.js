/*
 * Software License Agreement (MIT License)
 *
 * Author: Duke Fong <d@d-l.io>
 */

import { sleep } from './utils/helper.js';
import { csa_to_page_pos } from './input_ctrl.js';
import { csa, cmd_sock } from './index.js';


function update_aux() {
    let dx = csa.cur_pos[0] - csa.old_pos[0];
    let dy = csa.cur_pos[1] - csa.old_pos[1];
    let dz = csa.cur_pos[2] - csa.old_pos[2];
    let dr = csa.cur_pos[3] - csa.old_pos[3];
    csa.aux_pos = [csa.aux_pos[0] + dx, csa.aux_pos[1] + dy, csa.aux_pos[2] + dz, csa.aux_pos[3] + dr];
    csa.old_pos = [csa.cur_pos[0], csa.cur_pos[1], csa.cur_pos[2], csa.cur_pos[3]];
}

async function get_camera_cfg() {
    cmd_sock.flush();
    await cmd_sock.sendto({'action': 'get_camera_cfg'}, ['server', 'dev']);
    let dat = await cmd_sock.recvfrom(500);
    console.log('get_camera_cfg ret', dat);
    document.getElementById('camera_en').checked = !!dat[0].enable;
    document.getElementById('limit_angle').checked = !!dat[0].limit;
    document.getElementById('cv_detect').checked = !!dat[0].detect;
}

async function get_motor_pos() {
    cmd_sock.flush();
    await cmd_sock.sendto({'action': 'get_motor_pos'}, ['server', 'dev']);
    let dat = await cmd_sock.recvfrom(500);
    console.log('get_cur_pos ret', dat);
    csa.cur_pos = dat[0];
    update_aux();
    csa_to_page_pos();
}

async function get_init_home() {
    cmd_sock.flush();
    await cmd_sock.sendto({'action': 'get_init_home'}, ['server', 'dev']);
    let dat = await cmd_sock.recvfrom(500);
    console.log('get_init_home ret', dat);
    if (dat[0])
        document.getElementById('btn_set_home').style.backgroundColor = '';
}

async function set_motor_pos(wait=false, speed=260000) {
    console.log('set_motor_pos:', csa.cur_pos);
    cmd_sock.flush();
    await cmd_sock.sendto({'action': 'set_motor_pos', 'pos': csa.cur_pos, 'wait': wait, 'speed': speed}, ['server', 'dev']);
    let dat = await cmd_sock.recvfrom(20000);
    console.log('set_motor_pos ret', dat);
    update_aux();
    csa_to_page_pos();
}

async function set_pump(val) {
    cmd_sock.flush();
    await cmd_sock.sendto({'action': 'set_pump', 'val': val}, ['server', 'dev']);
    let dat = await cmd_sock.recvfrom(2000);
    console.log(`set_pump ${val} ret`, dat);
    document.getElementById('pump_en').checked = val ? true : false;
}

async function update_coeffs() {
    cmd_sock.flush();
    await cmd_sock.sendto({'action': 'update_coeffs', 'pcb': csa.fiducial_pcb, 'cam': csa.fiducial_cam}, ['server', 'dev']);
    let dat = await cmd_sock.recvfrom(1500);
    console.log('update_coeffs ret', dat);
}

async function pcb2xyz(idx, x, y) {
    cmd_sock.flush();
    await cmd_sock.sendto({'action': 'pcb2xyz', 'idx': idx, 'x': x, 'y': y}, ['server', 'dev']);
    let dat = await cmd_sock.recvfrom(1000);
    console.log('pcb2xyz ret', dat);
    return dat ? dat[0] : null;
}

async function z_keep_high(speed=260000) {
    let min_z = Math.max(csa.pcb_top_z, csa.comp_top_z);
    if (csa.cur_pos[2] != min_z) {
        csa.cur_pos[2] = min_z;
        await set_motor_pos(true, speed);
    }
}

async function enable_force() {
    cmd_sock.flush();
    await cmd_sock.sendto({'action': 'enable_force'}, ['server', 'dev']);
    let dat = await cmd_sock.recvfrom(1000);
    console.log('enable_force ret', dat);
    return dat ? dat[0] : null;
}

async function get_cv_cur() {
    cmd_sock.flush();
    await cmd_sock.sendto({'action': 'get_cv_cur'}, ['server', 'dev']);
    let dat = await cmd_sock.recvfrom(1000);
    console.log('get_cv_cur ret', dat);
    return dat ? dat[0] : null;
}

// 10mm / 275 pixel
let DIV_MM2PIXEL = 10/275;

async function cam_comp_snap() {
    for (let i = 0; i < 3; i++) {
        let cv = await get_cv_cur();
        if (cv) {
            let dx = (cv[0] - 480/2) * DIV_MM2PIXEL
            let dy = (cv[1] - 640/2) * DIV_MM2PIXEL
            console.log('cv dx dy', dx, dy)
            csa.cur_pos[0] += dx
            csa.cur_pos[1] += dy
            csa.cur_pos[3] = 0
            csa.cv_cur_r = cv[2]
            await set_motor_pos(true);
        }
        await sleep(600);
    }
    let cv = await get_cv_cur();
    return cv ? 0 : -1;
}


export {
    get_camera_cfg, get_init_home, get_motor_pos, set_motor_pos, set_pump,
    update_coeffs, pcb2xyz, z_keep_high, enable_force, get_cv_cur, cam_comp_snap
};
