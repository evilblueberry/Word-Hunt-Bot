import pandas as pd

# open and read the word list file
with open('scrabble_words.txt', 'r') as file:
    words = [word.lower() for word in file.read().splitlines()]

# create a DataFrame with each word and corresponding value 
data = []
value_of_length = [100, 400, 800, 1400, 1800, 2200]
for word in words:
    length = len(word)
    
    if length < 3:
        value = 0
    elif 3 <= length <= 7:
        value = value_of_length[length - 3]
    else: 
        value = 2200

    data.append({'Name': word, 'Value': value})

word_dictionary = pd.DataFrame(data)



# creates a temporary dictionary for current grid
def temp_dictionary(letters_flattened):
    def can_form_word(word, letters):
        return all(letter in letters for letter in set(word.lower()))

    temp_dic = word_dictionary[word_dictionary['Name'].apply(lambda x: can_form_word(x, letters_flattened))]

    return temp_dic


