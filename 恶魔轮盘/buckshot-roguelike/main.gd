extends Node2D

# --- 游戏数据 ---
var magazine = []       
var current_shot = 0    
var player_hp = 3
var demon_hp = 3
var is_player_turn = true 

# --- 道具库存 ---
var has_magnifier = true 
var has_saw = true      

# --- 临时状态 ---
var damage_multiplier = 1 

func _ready():
	print("游戏初始化成功！")
	randomize()
	$RestartButton.visible = false 
	reload_gun()

func reload_gun():
	magazine.clear()
	current_shot = 0
	var bullets_count = randi_range(3, 5)
	for i in range(bullets_count):
		magazine.append(randi() % 2)
	
	if not 1 in magazine:
		magazine[0] = 1
		magazine.shuffle()
	
	is_player_turn = true
	# --- 补给道具 ---
	has_magnifier = true
	has_saw = true 
	damage_multiplier = 1 
	
	update_ui("装弹完毕！\n新的回合开始。")
	enable_buttons(true)

func fire(target_is_self: bool):
	enable_buttons(false)
	
	if current_shot >= magazine.size():
		update_ui("弹匣空了，正在重装...")
		await get_tree().create_timer(1.5).timeout 
		reload_gun()
		return

	var is_real = magazine[current_shot] == 1
	current_shot += 1
	
	var result_msg = ""
	var shooter_name = "玩家" if is_player_turn else "恶魔"
	
	if is_real:
		$SfxShoot.play()
		# 屏幕震动
		shake_screen(10.0 * damage_multiplier) 
		
		var final_damage = 1 * damage_multiplier 
		result_msg = "【砰！】实弹！(伤害 " + str(final_damage) + ")"
		
		if target_is_self:
			if is_player_turn:
				flash_effect($PlayerHP) # <--- 玩家受击动画
				player_hp -= final_damage
				result_msg += "\n你把自己崩了！"
			else:
				flash_effect($DemonHP) # <--- 恶魔受击动画
				demon_hp -= final_damage
				result_msg += "\n恶魔把自己崩了！"
			change_turn()
		else:
			if is_player_turn:
				flash_effect($DemonHP) # <--- 恶魔受击动画
				demon_hp -= final_damage
				result_msg += "\n你击中了恶魔！"
			else:
				flash_effect($PlayerHP) # <--- 玩家受击动画
				player_hp -= final_damage
				result_msg += "\n恶魔击中了你！"
			change_turn()
	else:
		$SfxEmpty.play()
		# 空弹轻微震动
		shake_screen(3.0)
		result_msg = "【咔哒】是空弹。"
		if target_is_self:
			result_msg += "\n" + shooter_name + "运气不错，继续回合！"
			if not is_player_turn:
				start_demon_turn()
			else:
				enable_buttons(true)
		else:
			result_msg += "\n" + shooter_name + "打空了，轮换！"
			change_turn()

	damage_multiplier = 1 
	update_ui(result_msg)
	check_game_over()

# --- 道具逻辑 ---
func use_magnifier():
	has_magnifier = false
	enable_buttons(true) 
	var next_bullet = magazine[current_shot]
	if next_bullet == 1:
		update_ui("【放大镜】显示：下一发是 🔥 实弹")
	else:
		update_ui("【放大镜】显示：下一发是 💨 空弹")

func use_saw():
	has_saw = false
	damage_multiplier = 2
	update_ui("【锯子】你锯短了枪管...\n下一发实弹将造成 2 点伤害！")
	enable_buttons(true) 

# --- 🎨 动画特效区域 ---

# 新增：受击闪白特效
func flash_effect(target_node: CanvasItem):
	var tween = create_tween()
	# 瞬间变高亮白
	tween.tween_property(target_node, "modulate", Color(3, 3, 3, 1), 0.05)
	# 快速变回原色
	tween.tween_property(target_node, "modulate", Color.WHITE, 0.1)

# 屏幕震动特效
func shake_screen(intensity: float):
	var tween = create_tween()
	tween.tween_property(self, "position", Vector2(intensity, 0), 0.05)
	tween.tween_property(self, "position", Vector2(-intensity, 0), 0.05)
	tween.tween_property(self, "position", Vector2(0, 0), 0.05)

# --- 游戏流程逻辑 ---
func change_turn():
	is_player_turn = !is_player_turn
	damage_multiplier = 1 
	await get_tree().create_timer(1.0).timeout
	
	if is_player_turn:
		update_ui(">>> 轮到【玩家】行动")
		enable_buttons(true)
	else:
		update_ui(">>> 轮到【恶魔】行动")
		start_demon_turn()

func start_demon_turn():
	await get_tree().create_timer(1.5).timeout
	var ai_decision = randi() % 2 
	if ai_decision == 0:
		update_ui("恶魔缓缓把枪口对准了自己...")
		await get_tree().create_timer(1.0).timeout
		fire(true)
	else:
		update_ui("恶魔把枪口对准了你！")
		await get_tree().create_timer(1.0).timeout
		fire(false)

func update_ui(message: String):
	$Label.text = ">>> 战况 <<<\n" + message
	update_visuals()

func update_visuals():
	var player_charges = $PlayerHP.get_children()
	for i in range(player_charges.size()):
		player_charges[i].visible = player_hp > i
	var demon_charges = $DemonHP.get_children()
	for i in range(demon_charges.size()):
		demon_charges[i].visible = demon_hp > i
	var bullets_left = magazine.size() - current_shot
	var ammo_icons = $AmmoRow.get_children()
	for i in range(ammo_icons.size()):
		if i < bullets_left:
			ammo_icons[i].visible = true
		else:
			ammo_icons[i].visible = false

func enable_buttons(enabled: bool):
	$Button.disabled = !enabled
	$Button2.disabled = !enabled
	$MagButton.disabled = !(enabled and has_magnifier)
	$SawButton.disabled = !(enabled and has_saw and damage_multiplier == 1)

func check_game_over():
	if player_hp <= 0:
		$Label.text = "你倒下了... 游戏结束。"
		game_end_setup()
	elif demon_hp <= 0:
		$Label.text = "恶魔消散了... 你赢了！"
		game_end_setup()

func game_end_setup():
	$Button.disabled = true
	$Button2.disabled = true
	$MagButton.disabled = true
	$SawButton.disabled = true
	set_process(false)
	$RestartButton.visible = true

func _on_restart_button_pressed() -> void:
	get_tree().reload_current_scene()

# --- 信号连接 ---
func _on_button_pressed() -> void:
	if is_player_turn: fire(true)
func _on_button_2_pressed() -> void:
	if is_player_turn: fire(false)
func _on_mag_button_pressed() -> void:
	if is_player_turn: use_magnifier()
func _on_saw_button_pressed() -> void:
	if is_player_turn: use_saw()

func _input(event):
	if not is_player_turn: return
	if event.is_action_pressed("ui_accept"): fire(true)
	elif event.is_action_pressed("ui_select"): fire(false)
