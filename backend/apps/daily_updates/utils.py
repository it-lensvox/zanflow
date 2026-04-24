from datetime import timedelta

def find_available_slots(busy_intervals, day_start, day_end, duration_minutes, interval_step=30):
    """
    Calculates free time slots using a sliding window approach.
    busy_intervals: List of tuples [(datetime_start, datetime_end), ...]
    """
    # 1. Sort and merge overlapping busy intervals
    if busy_intervals:
        busy_intervals.sort(key=lambda x: x[0])
        merged_busy = [busy_intervals[0]]
        for current in busy_intervals[1:]:
            prev = merged_busy[-1]
            if current[0] <= prev[1]:
                # Overlap found, merge them into one big block
                merged_busy[-1] = (prev[0], max(prev[1], current[1]))
            else:
                merged_busy.append(current)
    else:
        merged_busy = []

    # 2. Slide a window across the day to find valid gaps
    duration_delta = timedelta(minutes=duration_minutes)
    step_delta = timedelta(minutes=interval_step)
    free_slots = []
    
    current_time = day_start
    
    while current_time + duration_delta <= day_end:
        slot_end = current_time + duration_delta
        
        # Check if this potential slot overlaps with ANY merged busy block
        is_overlapping = False
        for b_start, b_end in merged_busy:
            # Overlap occurs if the slot starts before the busy block ends 
            # AND the slot ends after the busy block starts
            if current_time < b_end and slot_end > b_start:
                is_overlapping = True
                break
                
        if not is_overlapping:
            free_slots.append(current_time)
            
        current_time += step_delta
        
    return free_slots